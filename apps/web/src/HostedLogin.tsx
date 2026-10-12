import Brand from './Brand';
import {useState} from 'react';
import {bootstrap,local} from './offline';
import {FormInput,WorkflowForm} from './FormControls';
export default function HostedLogin({signedIn}:{signedIn:(organizationId:string)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  let device=await local.preferences.get('device');if(!device){device={key:'device',value:crypto.randomUUID()};await local.preferences.put(device);}
  const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,deviceId:device.value})});
  if(!response.ok)throw new Error(response.status===429?'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.':'البريد أو كلمة المرور غير صحيحة، أو الحساب غير مفعّل.');
  const snapshot=await bootstrap();await local.preferences.put({key:'scope',value:snapshot.organizationId});setPassword('');signedIn(snapshot.organizationId);
 }catch(e){setError(e instanceof Error?e.message:'تعذر الاتصال. تحقق من الإنترنت وحاول مجدداً.');}finally{setBusy(false);}}
 return <div className="welcome"><div className="welcome-card"><Brand tagline="إدارة المخزون والتكاليف"/><h1>مرحباً بك في FooDo</h1><p>سجّل الدخول إلى مساحة عملك لمتابعة المواد والوصفات والتكاليف.</p><WorkflowForm busy={busy} error={error} onEdit={()=>setError('')} onSubmit={e=>void submit(e)}><label>البريد الإلكتروني<FormInput aria-label="البريد الإلكتروني" type="email" required autoComplete="username" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<FormInput aria-label="كلمة المرور" type="password" required autoComplete="current-password" dir="ltr" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary wide" type="submit" disabled={busy}>{busy?'جارٍ تسجيل الدخول…':'تسجيل الدخول'}</button></WorkflowForm><p className="welcome-foot">يلزم الاتصال عند تسجيل الدخول. عملياتك المحفوظة تبقى على جهازك حتى المزامنة.</p></div></div>;
}
