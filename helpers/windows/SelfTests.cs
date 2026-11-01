using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Net.Sockets;
using System.Threading;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

namespace FooDo.Printing {
 class TestPrinter:IPrinterBackend {
  public int Calls;public string[] Names(){return new[]{"Physical test sink"};}
  public void Submit(Work work,Action sending){if(work.Job.title=="fail-before")throw new IOException();sending();if(work.Job.title=="fail-after")throw new IOException();Interlocked.Increment(ref Calls);}
 }
 static class SelfTests {
  static int count;
  static void Check(bool value,string label){if(!value)throw new Exception("FAILED: "+label);count++;Console.WriteLine("PASS "+label);}
  static Dictionary<string,object> Response(int port,string method,string path,string body,string origin,string token,string org,out int status){using(var client=new TcpClient("127.0.0.1",port)){
   client.ReceiveTimeout=5000;var bytes=Encoding.UTF8.GetBytes(body??"");string header=method+" "+path+" HTTP/1.1\r\nHost: 127.0.0.1:"+port+"\r\nOrigin: "+origin+"\r\nContent-Length: "+bytes.Length+"\r\nContent-Type: application/json\r\nX-FooDo-Token: "+token+"\r\nX-FooDo-Organization: "+org+"\r\n\r\n";var stream=client.GetStream();var head=Encoding.ASCII.GetBytes(header);stream.Write(head,0,head.Length);stream.Write(bytes,0,bytes.Length);var response=new StreamReader(stream).ReadToEnd();status=Int32.Parse(response.Split(' ')[1]);string content=response.Substring(response.IndexOf("\r\n\r\n")+4);return content==""?new Dictionary<string,object>():Json.Read<Dictionary<string,object>>(content);
  }}
  static string Png(){using(var image=new Bitmap(8,1)){using(var g=Graphics.FromImage(image))g.Clear(Color.White);image.SetPixel(0,0,Color.Black);using(var stream=new MemoryStream()){image.Save(stream,ImageFormat.Png);return Convert.ToBase64String(stream.ToArray());}}}
  static PrintJob Job(string title){return new PrintJob {version=1,id=Guid.NewGuid().ToString(),organizationId="grills",title=title,paper="roll80",orientation="portrait",printerId="roll80",createdAt=DateTime.UtcNow.ToString("o"),pages=new[]{new Page {width=8,height=1,png=Png()}}};}
  public static int Run(){try{
   string root=Environment.GetEnvironmentVariable("FOODO_PRINT_TEST_ROOT")??Path.Combine(Path.GetTempPath(),"foodo-print-tests");string path=Path.Combine(root,"run-"+Guid.NewGuid().ToString("N"),"settings.json");var store=new Store(path);store.Config.RollPrinter="Physical test sink";store.Save();var printer=new TestPrinter();
   Check(Store.OriginAllowed(Store.HostedOrigin)&&!Store.OriginAllowed("https://fodo.am-agent2026.workers.dev.evil.test"),"exact origin allowlist");
   string token=(string)((dynamic)store.Pair(Store.HostedOrigin,"grills",store.Code)).token;
   Check(!File.ReadAllText(path).Contains(token),"pair token stored only as a hash");
   bool denied=false;try{store.Authorize(Store.HostedOrigin,"other",token);}catch(ApiError){denied=true;}Check(denied,"organization isolation");
   var bad=Job("bad");bad.pages[0].width=2048;denied=false;try{JobValidation.Validate(bad,"grills");}catch(ApiError){denied=true;}Check(denied,"PNG header and declared dimensions match");
   bad=Job("expired");bad.createdAt=DateTime.UtcNow.AddHours(-1).ToString("o");denied=false;try{JobValidation.Validate(bad,"grills");}catch(ApiError){denied=true;}Check(denied,"stale jobs rejected");
   using(var bitmap=new Bitmap(8,1)){using(var g=Graphics.FromImage(bitmap))g.Clear(Color.White);bitmap.SetPixel(0,0,Color.Black);var raster=Raster.Image(bitmap,8);Check(raster.Take(8).SequenceEqual(new byte[]{29,118,48,0,1,0,1,0})&&raster[8]==128,"ESC/POS raster header and bit order");}
   using(var service=new PrintService(store,printer)){service.Start(0);int status;var result=Response(service.Port,"GET","/v1/status",null,Store.HostedOrigin,"","",out status);Check(status==200&&(string)result["platform"]=="windows","loopback HTTP service");
    Response(service.Port,"OPTIONS","/v1/jobs",null,"https://evil.test","","",out status);Check(status==403,"untrusted preflight denied");
    Response(service.Port,"GET","/v1/printers",null,Store.HostedOrigin,"wrong","grills",out status);Check(status==401,"printer list requires paired authentication");
    var job=Job("Arabic أرز");string body=Json.Write(job);Response(service.Port,"POST","/v1/jobs",body,Store.HostedOrigin,token,"grills",out status);Check(status==202,"valid paired job accepted");
    for(int i=0;i<100&&Volatile.Read(ref printer.Calls)==0;i++)Thread.Sleep(10);
    Response(service.Port,"POST","/v1/jobs",body,Store.HostedOrigin,token,"grills",out status);Check(status==202&&printer.Calls==1,"duplicate request does not print twice");
    job.title="changed";Response(service.Port,"POST","/v1/jobs",Json.Write(job),Store.HostedOrigin,token,"grills",out status);Check(status==409,"changed payload cannot reuse a job ID");
    var before=Job("fail-before");Response(service.Port,"POST","/v1/jobs",Json.Write(before),Store.HostedOrigin,token,"grills",out status);var after=Job("fail-after");Response(service.Port,"POST","/v1/jobs",Json.Write(after),Store.HostedOrigin,token,"grills",out status);
    for(int i=0;i<100;i++){lock(store.Gate){if(store.Find(after.id,"grills").status=="unknown")break;}Thread.Sleep(10);}
    lock(store.Gate){Check(store.Find(before.id,"grills").status=="failed"&&store.Find(after.id,"grills").status=="unknown","failed versus ambiguous printer submission");}
    var limited=Job("oversize");limited.pages=new Page[41];Response(service.Port,"POST","/v1/jobs",Json.Write(limited),Store.HostedOrigin,token,"grills",out status);Check(status==400,"bounded page count");
    Response(service.Port,"GET","/v1/jobs/"+job.id,null,Store.HostedOrigin,token,"other",out status);Check(status==401,"job status cannot cross organizations");
    store.Revoke();Response(service.Port,"GET","/v1/printers",null,Store.HostedOrigin,token,"grills",out status);Check(status==401,"revocation invalidates prior tokens");
   }
   lock(store.Gate){store.Config.Jobs[0].status="sending";store.Save();}var restarted=new Store(path);Check(restarted.Config.Jobs[0].status=="unknown"&&printer.Calls==1,"restart marks uncertain work without replaying");
   string code=restarted.Code;for(int i=0;i<5;i++){try{restarted.Pair(Store.HostedOrigin,"grills","INVALID");}catch(ApiError){}}denied=false;try{restarted.Pair(Store.HostedOrigin,"grills",code);}catch(ApiError e){denied=e.Status==429;}Check(denied,"pairing attempt rate limit");
   Console.WriteLine(count+" native helper checks passed; no printer was used.");return 0;
  }catch(Exception e){Console.Error.WriteLine(e.ToString());return 1;}}
 }
}
