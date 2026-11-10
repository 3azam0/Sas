using System;
using System.IO;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Threading;
using System.Windows.Forms;

internal static class FooDoAttendance {
 [STAThread]
 private static void Main() {
  string root=AppDomain.CurrentDomain.BaseDirectory;
  try {
   var state=InitialSessionState.CreateDefault();
   state.ExecutionPolicy=Microsoft.PowerShell.ExecutionPolicy.Bypass;
   using(var runspace=RunspaceFactory.CreateRunspace(state)) {
    runspace.ApartmentState=ApartmentState.STA;
    runspace.ThreadOptions=PSThreadOptions.UseCurrentThread;
    runspace.Open();
    using(var shell=PowerShell.Create()) {
     shell.Runspace=runspace;
     shell.AddCommand(Path.Combine(root,"FooDo-Attendance.ps1"));
     shell.Invoke();
     if(shell.HadErrors) throw new InvalidOperationException(shell.Streams.Error[0].ToString());
    }
   }
  } catch(Exception error) {
   string log=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FooDo","AttendanceSync","desktop-startup.log");
   try {Directory.CreateDirectory(Path.GetDirectoryName(log));File.AppendAllText(log,DateTime.Now.ToString("s")+" "+error.Message+Environment.NewLine);} catch {}
   MessageBox.Show("The FooDo attendance window could not open. Check desktop-startup.log in the saved configuration folder.","FooDo Attendance",MessageBoxButtons.OK,MessageBoxIcon.Error);
  }
 }
}
