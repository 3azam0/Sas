using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Linq;
using System.Globalization;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Threading;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

namespace FooDo.Printing {
 static class Program {
  [STAThread] static int Main(string[] args) {
   if(args.Contains("--self-test")) return SelfTests.Run();
   bool created;using(var mutex=new Mutex(true,"Local\\FooDo.PrintHelper.v1",out created)) {
    Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
    if(!created){MessageBox.Show("مساعد الطباعة يعمل بالفعل. افتحه من أيقونة FooDo بجوار الساعة.","FooDo");return 0;}
    try { Application.Run(new HelperWindow());return 0; }
    catch(Exception e){MessageBox.Show("تعذر تشغيل مساعد الطباعة.\n"+e.Message,"FooDo",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
   }
  }
 }
 static class Json {
  static JavaScriptSerializer Serializer(){return new JavaScriptSerializer {MaxJsonLength=17000000,RecursionLimit=30};}
  public static string Write(object value){return Serializer().Serialize(value);}
  public static T Read<T>(string value){return Serializer().Deserialize<T>(value);}
  public static string Hash(string value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}
  public static bool Equal(string a,string b){if(a==null||b==null)return false;int diff=a.Length^b.Length;for(int i=0;i<Math.Min(a.Length,b.Length);i++)diff|=a[i]^b[i];return diff==0;}
  public static string Random(int bytes){var b=new byte[bytes];using(var r=RandomNumberGenerator.Create())r.GetBytes(b);return Convert.ToBase64String(b).TrimEnd('=').Replace('+','-').Replace('/','_');}
  public static void Save(string path,object value){Directory.CreateDirectory(Path.GetDirectoryName(path));var temp=path+".tmp";File.WriteAllText(temp,Write(value),new UTF8Encoding(false));if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);}
 }
 class ApiError:Exception {public int Status;public string Code;public ApiError(int status,string code,string message):base(message){Status=status;Code=code;}}
 public class Grant {public string Organization;public string Origin;public string TokenHash;}
 public class Receipt {public string id;public string organizationId;public string bodyHash;public string status;public string title;public string message;public string createdAt;}
 public class Settings {public string A4Printer="";public string RollPrinter="";public int RollWidth=576;public bool Cut=false;public List<Grant> Grants=new List<Grant>();public List<Receipt> Jobs=new List<Receipt>();}
 public class Printer {public string id;public string name;public string paper;public int widthDots;}
 public class Page {public int width;public int height;public string png;}
 public class PrintJob {public int version;public string id;public string organizationId;public string title;public string paper;public string orientation;public string printerId;public string createdAt;public Page[] pages;}
 class Work {public PrintJob Job;public string Printer;public int Width;public bool Cut;}
 interface IPrinterBackend {string[] Names();void Submit(Work work,Action sending);}
 class Store {
  public const string HostedOrigin="https://fodo.am-agent2026.workers.dev";
  public readonly object Gate=new object();public Settings Config;readonly string path;public string Code;public DateTime CodeUntil;DateTime attemptWindow=DateTime.UtcNow;int attempts;
  public Store(string file){path=file;Config=File.Exists(path)?Json.Read<Settings>(File.ReadAllText(path)):new Settings();if(Config==null||Config.Grants==null||Config.Jobs==null)throw new IOException("Printer settings could not be read.");foreach(var j in Config.Jobs)if(j.status=="queued"||j.status=="sending"){j.status="unknown";j.message="توقف المساعد أثناء الإرسال؛ افحص الطابعة قبل إعادة الطباعة.";}Rotate();Save();}
  public static bool OriginAllowed(string origin){return origin==HostedOrigin||origin=="http://127.0.0.1:3108";}
  public void Save(){Json.Save(path,Config);}
  public void Rotate(){lock(Gate){const string chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";var bytes=new byte[8];using(var r=RandomNumberGenerator.Create())r.GetBytes(bytes);Code=new string(bytes.Select(b=>chars[b%chars.Length]).ToArray());CodeUntil=DateTime.UtcNow.AddMinutes(10);}}
  public object Pair(string origin,string organization,string code){lock(Gate){
   if(DateTime.UtcNow-attemptWindow>TimeSpan.FromMinutes(1)){attemptWindow=DateTime.UtcNow;attempts=0;}
   if(++attempts>5)throw new ApiError(429,"PAIR_LIMIT","محاولات كثيرة. انتظر دقيقة.");
   if(String.IsNullOrWhiteSpace(organization)||organization.Length>80||!System.Text.RegularExpressions.Regex.IsMatch(organization,"^[A-Za-z0-9_-]+$"))throw new ApiError(400,"SCOPE","معرّف المؤسسة غير صالح.");
   if(DateTime.UtcNow>CodeUntil||!Json.Equal(Code,(code??"").Trim().ToUpperInvariant()))throw new ApiError(403,"PAIR_CODE","رمز الربط غير صحيح أو انتهت صلاحيته.");
   if(Config.Grants.Count>=20)throw new ApiError(409,"PAIR_FULL","ألغِ ربط المتصفحات القديمة من المساعد أولاً.");
   var token=Json.Random(32);Config.Grants.Add(new Grant {Organization=organization,Origin=origin,TokenHash=Json.Hash(token)});Save();Rotate();
   return new {token=token,protocol=1,platform="windows",service="foodo-print",organizationId=organization};
  }}
  public void Authorize(string origin,string organization,string token){lock(Gate){if(String.IsNullOrEmpty(token)||token.Length>100||!Config.Grants.Any(g=>g.Organization==organization&&g.Origin==origin&&Json.Equal(g.TokenHash,Json.Hash(token))))throw new ApiError(401,"PAIR_REQUIRED","اربط هذا المتصفح بالمساعد أولاً.");}}
  public void Revoke(){lock(Gate){Config.Grants.Clear();Save();Rotate();}}
  public Receipt Find(string id,string organization){return Config.Jobs.FirstOrDefault(j=>j.id==id&&j.organizationId==organization);}
  public void Status(string id,string organization,string status,string message){lock(Gate){var job=Find(id,organization);job.status=status;job.message=message;Save();}}
 }
 static class JobValidation {
  public static void Validate(PrintJob job,string organization){
   Guid id;DateTime stamp;
   if(job==null||job.version!=1||!Guid.TryParse(job.id,out id)||job.organizationId!=organization)throw new ApiError(400,"JOB_SCOPE","طلب الطباعة غير صالح لهذه المؤسسة.");
   if(!DateTime.TryParse(job.createdAt,CultureInfo.InvariantCulture,DateTimeStyles.RoundtripKind,out stamp)||DateTime.UtcNow-stamp.ToUniversalTime()>TimeSpan.FromMinutes(10)||stamp.ToUniversalTime()-DateTime.UtcNow>TimeSpan.FromMinutes(5))throw new ApiError(400,"JOB_EXPIRED","أعد تجهيز المستند؛ انتهت صلاحية طلب الطباعة.");
   if(String.IsNullOrWhiteSpace(job.title)||job.title.Length>160||(job.paper!="a4"&&job.paper!="roll80")||job.printerId!=job.paper||(job.orientation!="portrait"&&job.orientation!="landscape")||job.pages==null||job.pages.Length<1||job.pages.Length>40)throw new ApiError(400,"JOB_INVALID","مقاس الورق أو بيانات المستند غير صالحة.");
   long pixels=0;foreach(var p in job.pages){
    if(p==null||p.width<1||p.width>2480||p.height<1||p.height>8192||p.png==null||p.png.Length>8000000)throw new ApiError(413,"IMAGE_LIMIT","حجم صفحة الطباعة يتجاوز الحد المسموح.");
    pixels+=(long)p.width*p.height;if(pixels>32000000)throw new ApiError(413,"IMAGE_LIMIT","المستند كبير جداً. اطبع نطاقاً أصغر.");
    byte[] data;try{data=Convert.FromBase64String(p.png);}catch{throw new ApiError(400,"IMAGE_INVALID","صورة الطباعة غير صالحة.");}
    var signature=new byte[]{137,80,78,71,13,10,26,10};
    if(data.Length<33||!signature.SequenceEqual(data.Take(8))||Encoding.ASCII.GetString(data,12,4)!="IHDR"||ReadInt(data,16)!=p.width||ReadInt(data,20)!=p.height)throw new ApiError(400,"IMAGE_INVALID","أبعاد صورة الطباعة غير متطابقة.");
    try{using(var stream=new MemoryStream(data))using(var image=Image.FromStream(stream,true,true))if(image.Width!=p.width||image.Height!=p.height)throw new Exception();}catch{throw new ApiError(400,"IMAGE_INVALID","تعذر قراءة صورة الطباعة.");}
   }
  }
  static int ReadInt(byte[] b,int i){return (b[i]<<24)|(b[i+1]<<16)|(b[i+2]<<8)|b[i+3];}
 }
 class PrintService:IDisposable {
  public const int DefaultPort=17856;public readonly Store Store;readonly IPrinterBackend backend;readonly BlockingCollection<Work> queue=new BlockingCollection<Work>(3);readonly SemaphoreSlim connections=new SemaphoreSlim(4);TcpListener listener;volatile bool running;public int Port;public Action Changed=delegate{};
  public PrintService(Store store,IPrinterBackend printer){Store=store;backend=printer;}
  public void Start(int port){listener=new TcpListener(IPAddress.Loopback,port);listener.Start(8);Port=((IPEndPoint)listener.LocalEndpoint).Port;running=true;new Thread(Accept){IsBackground=true}.Start();new Thread(Worker){IsBackground=true}.Start();}
  void Accept(){while(running){try{var client=listener.AcceptTcpClient();if(!connections.Wait(0)){client.Close();continue;}ThreadPool.QueueUserWorkItem(delegate{try{Handle(client);}catch(IOException){}catch(SocketException){}catch(InvalidOperationException){}finally{connections.Release();}});}catch(SocketException){if(!running)return;}catch(ObjectDisposedException){return;}}}
  void Worker(){foreach(var work in queue.GetConsumingEnumerable()){
   bool sending=false;try{backend.Submit(work,delegate{Store.Status(work.Job.id,work.Job.organizationId,"sending","جارٍ التسليم إلى طابور الطابعة.");sending=true;Changed();});Store.Status(work.Job.id,work.Job.organizationId,"submitted","تم التسليم إلى طابور الطابعة؛ تحقق من خروج الورق.");}
   catch(Exception){Store.Status(work.Job.id,work.Job.organizationId,sending?"unknown":"failed",sending?"تعذر تأكيد الإرسال؛ افحص الطابعة قبل طلب نسخة أخرى.":"لم يبدأ الإرسال. تحقق من الطابعة وإعداداتها.");}Changed();
  }}
  public object Printers(){lock(Store.Gate){var names=backend.Names();var printers=new List<Printer>();if(names.Contains(Store.Config.A4Printer))printers.Add(new Printer {id="a4",paper="a4",name=Store.Config.A4Printer,widthDots=0});if(names.Contains(Store.Config.RollPrinter))printers.Add(new Printer {id="roll80",paper="roll80",name=Store.Config.RollPrinter,widthDots=Store.Config.RollWidth});return new {printers=printers,protocol=1};}}
  public Receipt Submit(string body,string organization){var job=Json.Read<PrintJob>(body);if(job==null)throw new ApiError(400,"JOB_INVALID","طلب الطباعة فارغ.");lock(Store.Gate){
   var old=Store.Find(job.id,organization);if(old!=null){if(!Json.Equal(old.bodyHash,Json.Hash(body)))throw new ApiError(409,"JOB_CONFLICT","المعرّف مستخدم لمستند مختلف؛ لا تعاود الإرسال.");return old;}
   JobValidation.Validate(job,organization);
   string printer=job.paper=="a4"?Store.Config.A4Printer:Store.Config.RollPrinter;if(String.IsNullOrEmpty(printer)||!backend.Names().Contains(printer))throw new ApiError(409,"PRINTER_MISSING","اختر طابعة لهذا المقاس في نافذة المساعد.");
   if(queue.Count>=3)throw new ApiError(429,"QUEUE_FULL","طابور المساعد ممتلئ؛ تحقق من حالته قبل المحاولة.");
   Store.Config.Jobs.RemoveAll(j=>DateTime.Parse(j.createdAt,CultureInfo.InvariantCulture,DateTimeStyles.RoundtripKind).ToUniversalTime()<DateTime.UtcNow.AddDays(-1)&&j.status!="queued"&&j.status!="sending");
   if(Store.Config.Jobs.Count>=500)throw new ApiError(429,"JOB_LIMIT","بلغ المساعد الحد اليومي للمستندات. حاول لاحقاً.");
   var receipt=new Receipt {id=job.id,organizationId=organization,bodyHash=Json.Hash(body),status="queued",title=job.title,createdAt=DateTime.UtcNow.ToString("o"),message="حُفظ طلب الطباعة في المساعد."};Store.Config.Jobs.Add(receipt);Store.Save();
   if(!queue.TryAdd(new Work {Job=job,Printer=printer,Width=Store.Config.RollWidth,Cut=Store.Config.Cut})){Store.Status(job.id,organization,"failed","الطابور ممتلئ؛ لم يبدأ الإرسال.");}Changed();return receipt;
  }}
  void Handle(TcpClient client){using(client){client.ReceiveTimeout=10000;client.SendTimeout=10000;string origin=null;int status=200;object result;try{
   var request=Request.Read(client.GetStream());origin=request.Header("Origin");if(request.Header("Host")!="127.0.0.1:"+Port)throw new ApiError(403,"HOST","غير مسموح.");if(!Store.OriginAllowed(origin))throw new ApiError(403,"ORIGIN","مصدر الطلب غير مسموح.");
   if(request.Method=="OPTIONS"){Reply(client.GetStream(),204,null,origin);return;}
   if(request.Method=="GET"&&request.Path=="/v1/status")result=new {service="foodo-print",protocol=1,version="1.0.0",platform="windows"};
   else if(request.Method=="POST"&&request.Path=="/v1/pair"){var p=Json.Read<Dictionary<string,string>>(request.Body);result=Store.Pair(origin,p.ContainsKey("organizationId")?p["organizationId"]:null,p.ContainsKey("code")?p["code"]:null);Changed();}
   else {string organization=request.Header("X-FooDo-Organization");Store.Authorize(origin,organization,request.Header("X-FooDo-Token"));
    if(request.Method=="GET"&&request.Path=="/v1/printers")result=Printers();
    else if(request.Method=="POST"&&request.Path=="/v1/jobs"){result=Submit(request.Body,organization);status=202;}
    else if(request.Method=="GET"&&request.Path.StartsWith("/v1/jobs/")){lock(Store.Gate){result=Store.Find(request.Path.Substring(9),organization);if(result==null)throw new ApiError(404,"JOB_UNKNOWN","لم يُعثر على سجل مؤكد؛ افحص الطابعة قبل إعادة الطباعة.");}}
    else throw new ApiError(404,"NOT_FOUND","المسار غير متاح.");
   }
  }catch(ApiError e){status=e.Status;result=new {code=e.Code,message=e.Message};}catch(Exception){status=400;result=new {code="INVALID_REQUEST",message="تعذر قراءة الطلب."};}
   try{Reply(client.GetStream(),status,result,Store.OriginAllowed(origin)?origin:null);}catch(IOException){}catch(SocketException){}
  }}
  static void Reply(Stream stream,int status,object value,string origin){byte[] body=value==null?new byte[0]:Encoding.UTF8.GetBytes(Json.Write(value));string header="HTTP/1.1 "+status+" Result\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\nContent-Length: "+body.Length+"\r\n";if(origin!=null)header+="Access-Control-Allow-Origin: "+origin+"\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-FooDo-Token, X-FooDo-Organization\r\nAccess-Control-Allow-Private-Network: true\r\n";var bytes=Encoding.ASCII.GetBytes(header+"\r\n");stream.Write(bytes,0,bytes.Length);stream.Write(body,0,body.Length);}
  public void Dispose(){running=false;if(listener!=null)listener.Stop();queue.CompleteAdding();}
 }
 class Request {
  public string Method,Path,Body;Dictionary<string,string> headers=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  public string Header(string name){return headers.ContainsKey(name)?headers[name]:"";}
  public static Request Read(Stream stream){var bytes=new List<byte>();while(true){int b=stream.ReadByte();if(b<0)throw new IOException();bytes.Add((byte)b);if(bytes.Count>16384)throw new ApiError(413,"HEADER_LIMIT","Headers too large.");int n=bytes.Count;if(n>=4&&bytes[n-4]==13&&bytes[n-3]==10&&bytes[n-2]==13&&bytes[n-1]==10)break;}
   var lines=Encoding.ASCII.GetString(bytes.ToArray()).Split(new[]{"\r\n"},StringSplitOptions.None);var first=lines[0].Split(' ');if(first.Length!=3||first[2]!="HTTP/1.1"||!first[1].StartsWith("/v1/")||first[1].Contains("?")||first[1].Length>100)throw new ApiError(400,"HTTP","Invalid request.");var r=new Request {Method=first[0],Path=first[1]};
   foreach(var line in lines.Skip(1)){if(line=="")continue;int colon=line.IndexOf(':');if(colon<1||r.headers.ContainsKey(line.Substring(0,colon)))throw new ApiError(400,"HTTP","Invalid header.");r.headers.Add(line.Substring(0,colon),line.Substring(colon+1).Trim());}
   int length=0;if(r.Header("Transfer-Encoding")!=""||r.Header("Content-Length")!=""&&!Int32.TryParse(r.Header("Content-Length"),out length)||length<0||length>16000000)throw new ApiError(413,"BODY_LIMIT","Request too large.");
   if(r.Method=="POST"&&(length==0||r.Header("Content-Type").Split(';')[0].Trim()!="application/json"))throw new ApiError(400,"CONTENT_TYPE","JSON required.");if(r.Method!="POST"&&length!=0)throw new ApiError(400,"HTTP","Unexpected body.");
   var body=new byte[length];int read=0;while(read<length){int count=stream.Read(body,read,Math.Min(8192,length-read));if(count==0)throw new IOException();read+=count;}r.Body=new UTF8Encoding(false,true).GetString(body);return r;
  }
 }
 static class Raster {
  public static byte[] Image(Bitmap image,int width){int height=(int)Math.Ceiling((double)image.Height*width/image.Width);using(var bitmap=new Bitmap(width,height,PixelFormat.Format24bppRgb)){
   using(var g=Graphics.FromImage(bitmap)){g.Clear(Color.White);g.DrawImage(image,new Rectangle(0,0,width,height));}
   var area=bitmap.LockBits(new Rectangle(0,0,width,height),ImageLockMode.ReadOnly,PixelFormat.Format24bppRgb);try{int rowBytes=(width+7)/8;using(var output=new MemoryStream()){
    var row=new byte[Math.Abs(area.Stride)];for(int start=0;start<height;start+=128){int rows=Math.Min(128,height-start);output.Write(new byte[]{29,118,48,0,(byte)(rowBytes%256),(byte)(rowBytes/256),(byte)(rows%256),(byte)(rows/256)},0,8);
     for(int y=start;y<start+rows;y++){Marshal.Copy(IntPtr.Add(area.Scan0,y*area.Stride),row,0,row.Length);for(int x=0;x<rowBytes;x++){byte dots=0;for(int bit=0;bit<8;bit++){int px=x*8+bit;if(px<width){int index=px*3;if(row[index+2]*299+row[index+1]*587+row[index]*114<160000)dots|=(byte)(128>>bit);}}output.WriteByte(dots);}}
    }return output.ToArray();
   }}finally{bitmap.UnlockBits(area);}
  }}
 }
 class WindowsPrinter:IPrinterBackend {
  public string[] Names(){return PrinterSettings.InstalledPrinters.Cast<string>().Where(n=>!Virtual(n)).ToArray();}
  static bool Virtual(string name){var n=name.ToLowerInvariant();return n.Contains("pdf")||n.Contains("xps")||n.Contains("onenote")||n=="fax";}
  public void Submit(Work work,Action sending){if(!Names().Contains(work.Printer))throw new IOException("Printer unavailable.");if(work.Job.paper=="a4")A4(work,sending);else Roll(work,sending);}
  static void A4(Work work,Action sending){using(var doc=new PrintDocument()){
   doc.PrinterSettings.PrinterName=work.Printer;doc.PrinterSettings.Copies=1;doc.PrinterSettings.PrintToFile=false;doc.DocumentName=work.Job.title.Replace('\r',' ').Replace('\n',' ');doc.PrintController=new StandardPrintController();
   var paper=doc.PrinterSettings.PaperSizes.Cast<PaperSize>().FirstOrDefault(p=>p.Kind==PaperKind.A4);if(paper==null)throw new IOException("A4 is not supported by this queue.");doc.DefaultPageSettings.PaperSize=paper;doc.DefaultPageSettings.Landscape=work.Job.orientation=="landscape";doc.DefaultPageSettings.Margins=new Margins(0,0,0,0);int index=0;
   doc.PrintPage+=delegate(object sender,PrintPageEventArgs e){using(var stream=new MemoryStream(Convert.FromBase64String(work.Job.pages[index].png)))using(var image=Image.FromStream(stream)){
    e.Graphics.TranslateTransform(-e.PageSettings.HardMarginX,-e.PageSettings.HardMarginY);e.Graphics.DrawImage(image,new Rectangle(0,0,e.PageBounds.Width,e.PageBounds.Height));
   }index++;e.HasMorePages=index<work.Job.pages.Length;};sending();doc.Print();
  }}
  static void Roll(Work work,Action sending){IntPtr printer;if(!Raw.OpenPrinter(work.Printer,out printer,IntPtr.Zero))throw new IOException("Printer unavailable.");try{
   var info=new Raw.DocInfo {Name=work.Job.title,Type="RAW"};sending();if(Raw.StartDocPrinter(printer,1,info)==0)throw new IOException("Queue rejected job.");try{if(!Raw.StartPagePrinter(printer))throw new IOException();Raw.Write(printer,new byte[]{27,64});
    foreach(var page in work.Job.pages)using(var stream=new MemoryStream(Convert.FromBase64String(page.png)))using(var image=new Bitmap(stream))Raw.Write(printer,Raster.Image(image,work.Width));
    Raw.Write(printer,new byte[]{27,100,3});if(work.Cut)Raw.Write(printer,new byte[]{29,86,0});if(!Raw.EndPagePrinter(printer))throw new IOException();
   }finally{if(!Raw.EndDocPrinter(printer))throw new IOException("Could not finalize the printer queue job.");}
  }finally{Raw.ClosePrinter(printer);}}
 }
 static class Raw {
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public class DocInfo {[MarshalAs(UnmanagedType.LPWStr)]public string Name;[MarshalAs(UnmanagedType.LPWStr)]public string Output=null;[MarshalAs(UnmanagedType.LPWStr)]public string Type;}
  [DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Unicode)]public static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
  [DllImport("winspool.drv",SetLastError=true,CharSet=CharSet.Unicode)]public static extern int StartDocPrinter(IntPtr handle,int level,[In]DocInfo info);
  [DllImport("winspool.drv",SetLastError=true)]public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv",SetLastError=true)]public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv",SetLastError=true)]public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv",SetLastError=true)]public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv",SetLastError=true)]static extern bool WritePrinter(IntPtr handle,byte[] data,int count,out int written);
  public static void Write(IntPtr handle,byte[] data){int count;if(!WritePrinter(handle,data,data.Length,out count)||count!=data.Length)throw new IOException("Print submission interrupted.");}
 }
 class HelperWindow:Form {
  readonly Store store;readonly PrintService service;readonly ComboBox a4=new ComboBox(),roll=new ComboBox(),width=new ComboBox();readonly CheckBox cut=new CheckBox();readonly TextBox code=new TextBox();readonly Label status=new Label(),pairings=new Label();readonly NotifyIcon tray=new NotifyIcon();readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
  public HelperWindow(){Text="FooDo Print Helper · مساعد الطباعة";Size=new Size(620,620);MinimumSize=Size;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.White;RightToLeft=RightToLeft.Yes;RightToLeftLayout=true;
   store=new Store(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FooDo","PrintHelper","settings.json"));service=new PrintService(store,new WindowsPrinter());service.Start(PrintService.DefaultPort);
   var panel=new FlowLayoutPanel {Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(24)};Controls.Add(panel);
   Add(panel,new Label {Text="FooDo · الطباعة المباشرة",Font=new Font("Segoe UI",19,FontStyle.Bold),Height=45});Add(panel,new Label {Text="اختر الطابعات ثم اربط المتصفح برمز الربط. صغّر النافذة واترك المساعد يعمل.",Height=42});
   Add(panel,new Label {Text="طابعة A4",Height=23});Add(panel,a4);Add(panel,new Label {Text="طابعة رول 80 مم · ESC/POS",Height=23});Add(panel,roll);Add(panel,new Label {Text="عرض الطباعة بالنقاط · راجع دليل الطابعة",Height=23});width.DropDownStyle=ComboBoxStyle.DropDownList;width.Items.AddRange(new object[]{512,576,640});width.SelectedItem=store.Config.RollWidth;Add(panel,width);cut.Text="قص الورق تلقائياً (للطابعة الداعمة فقط)";cut.Checked=store.Config.Cut;Add(panel,cut);
   var save=new Button {Text="حفظ الطابعات",Height=34};save.Click+=delegate{lock(store.Gate){store.Config.A4Printer=a4.SelectedIndex>0?(string)a4.SelectedItem:"";store.Config.RollPrinter=roll.SelectedIndex>0?(string)roll.SelectedItem:"";store.Config.RollWidth=width.SelectedItem==null?576:(int)width.SelectedItem;store.Config.Cut=cut.Checked;store.Save();}status.Text="تم حفظ الطابعات. حدّث قائمة الطابعات في FooDo.";};Add(panel,save);
   Add(panel,new Label {Text="رمز ربط المتصفح · صالح 10 دقائق ولمرة واحدة",Height=25});code.ReadOnly=true;code.TextAlign=HorizontalAlignment.Center;code.Font=new Font("Consolas",20,FontStyle.Bold);code.RightToLeft=RightToLeft.No;Add(panel,code);Add(panel,pairings);
   var revoke=new Button {Text="إلغاء ربط كل المتصفحات وتغيير الرمز",Height=34};revoke.Click+=delegate{store.Revoke();RefreshStatus();};Add(panel,revoke);status.Height=58;Add(panel,status);
   foreach(var box in new[]{a4,roll}){box.DropDownStyle=ComboBoxStyle.DropDownList;box.Items.Add("بدون طابعة");box.Items.AddRange(new WindowsPrinter().Names());}a4.SelectedItem=store.Config.A4Printer;roll.SelectedItem=store.Config.RollPrinter;if(a4.SelectedIndex<0)a4.SelectedIndex=0;if(roll.SelectedIndex<0)roll.SelectedIndex=0;
   service.Changed=delegate{if(!IsDisposed&&IsHandleCreated)try{BeginInvoke(new Action(RefreshStatus));}catch(InvalidOperationException){}};
   tray.Icon=SystemIcons.Application;tray.Text="FooDo Print Helper";tray.Visible=true;var menu=new ContextMenuStrip();menu.Items.Add("فتح المساعد",null,delegate{Show();WindowState=FormWindowState.Normal;Activate();});menu.Items.Add("خروج",null,delegate{Close();});tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{Show();WindowState=FormWindowState.Normal;Activate();};Resize+=delegate{if(WindowState==FormWindowState.Minimized)Hide();};timer.Interval=1000;timer.Tick+=delegate{RefreshStatus();};timer.Start();RefreshStatus();
  }
  static void Add(FlowLayoutPanel panel,Control control){control.Width=540;control.Margin=new Padding(0,0,0,6);panel.Controls.Add(control);}
  void RefreshStatus(){lock(store.Gate){if(DateTime.UtcNow>store.CodeUntil)store.Rotate();code.Text=store.Code;pairings.Text="المتصفحات المرتبطة: "+store.Config.Grants.Count;var last=store.Config.Jobs.LastOrDefault();if(last!=null)status.Text=last.title+" · "+last.message;}}
  protected override void OnFormClosed(FormClosedEventArgs e){timer.Stop();tray.Visible=false;tray.Dispose();service.Dispose();base.OnFormClosed(e);}
 }
}
