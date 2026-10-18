'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {bootstrap,local} from './offline';
import AuthLayout,{AuthIcon} from './AuthLayout';
import {loginFailure,validateLogin,type LoginFieldErrors} from './auth-feedback';
type Props={signedIn:(organizationId:string)=>void;expectedOrganization?:string;organizationName?:string;close?:()=>void};
export default function HostedLogin(props:Props){return props.expectedOrganization?<LoginForm {...props}/>:<AuthLayout><LoginForm {...props}/></AuthLayout>;}
function LoginForm({signedIn,expectedOrganization,organizationName,close}:Props){
 const id=useId(),emailNode=useRef<HTMLInputElement>(null),passwordNode=useRef<HTMLInputElement>(null),errorNode=useRef<HTMLDivElement>(null),pending=useRef(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[caps,setCaps]=useState(false),[busy,setBusy]=useState(false),[phase,setPhase]=useState<'login'|'workspace'>('login'),[error,setError]=useState(''),[fields,setFields]=useState<LoginFieldErrors>({}),[online,setOnline]=useState(true),[help,setHelp]=useState(false);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);if(expectedOrganization)emailNode.current?.focus();return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[expectedOrganization]);
 useEffect(()=>{if(error)errorNode.current?.focus();},[error]);
 async function submit(event:FormEvent){
  event.preventDefault();if(pending.current)return;const issues=validateLogin(email,password);setFields(issues);setError('');
  if(issues.email||issues.password){(issues.email?emailNode:passwordNode).current?.focus();return;}
  if(!navigator.onLine){setOnline(false);return;}
  pending.current=true;setBusy(true);setPhase('login');let authenticated=false;
  try{
   let device=await local.preferences.get('device');if(!device){device={key:'device',value:crypto.randomUUID()};await local.preferences.put(device);}
   const response=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({email:email.trim(),password,deviceId:device.value})});
   if(!response.ok){setError(loginFailure(response.status));return;}
   authenticated=true;setPhase('workspace');const snapshot=await bootstrap(expectedOrganization,AbortSignal.timeout(20000));await local.preferences.put({key:'scope',value:snapshot.organizationId});setPassword('');setVisible(false);signedIn(snapshot.organizationId);
  }catch(reason){
   if(authenticated)setError(expectedOrganization?'تعذر فتح بيانات المؤسسة الحالية. استخدم حسابًا مخوّلًا لهذه المؤسسة وحاول مجددًا. عملياتك المحفوظة لم تُمسح.':'تم التحقق من بيانات الدخول، لكن تعذر تحميل مساحة العمل. تحقق من الاتصال ثم حاول مجددًا.');
   else if(reason instanceof DOMException&&reason.name==='TimeoutError')setError('استغرق الاتصال وقتًا طويلًا. تحقق من الإنترنت ثم حاول مجددًا.');
   else setError('تعذر الاتصال. تحقق من الإنترنت ثم حاول مجددًا.');
  }finally{pending.current=false;setBusy(false);}
 }
 return <div className="auth-content"><div className="auth-heading"><span className="auth-heading-icon"><AuthIcon name="lock"/></span><span className="auth-eyebrow">{expectedOrganization?'متابعة العمل بأمان':'تسجيل الدخول إلى FooDo'}</span><h1 id={id+'-title'}>{expectedOrganization?'تجديد جلسة العمل':'مرحبًا بعودتك'}</h1><p>{expectedOrganization?<>سجّل الدخول لحساب مخوّل في <strong>{organizationName||'المؤسسة الحالية'}</strong> لمتابعة المزامنة.</>:'ادخل إلى مساحة عملك وتابع المخزون والمطابخ والتكاليف.'}</p></div>
  {expectedOrganization&&<div className="auth-preserved"><AuthIcon name="check"/><p>عملياتك المعلقة وبياناتك المحفوظة باقية على هذا الجهاز.</p></div>}
  <form className="auth-form" noValidate aria-labelledby={id+'-title'} aria-busy={busy} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){event.preventDefault();if(!busy&&!event.repeat)event.currentTarget.requestSubmit();}}} onSubmit={event=>void submit(event)}>
   <div className="auth-field"><label htmlFor={id+'-email'}>البريد الإلكتروني</label><div className="auth-input-wrap"><AuthIcon name="mail"/><input ref={emailNode} id={id+'-email'} name="email" type="email" dir="ltr" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="name@example.com" disabled={busy} value={email} aria-invalid={!!fields.email} aria-describedby={fields.email?id+'-email-error':undefined} onChange={e=>{setEmail(e.target.value);setFields(f=>({...f,email:undefined}));setError('');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();passwordNode.current?.focus();}}}/></div>{fields.email&&<small className="auth-field-error" id={id+'-email-error'}>{fields.email}</small>}</div>
   <div className="auth-field"><label htmlFor={id+'-password'}>كلمة المرور</label><div className="auth-input-wrap auth-password-wrap"><AuthIcon name="lock"/><input ref={passwordNode} id={id+'-password'} name="password" type={visible?'text':'password'} dir="ltr" required autoComplete="current-password" maxLength={100} placeholder="أدخل كلمة المرور" disabled={busy} value={password} aria-invalid={!!fields.password} aria-describedby={[fields.password?id+'-password-error':'',caps?id+'-caps':''].filter(Boolean).join(' ')||undefined} onBlur={()=>setCaps(false)} onKeyDown={e=>{setCaps(e.getModifierState('CapsLock'));if(e.key==='Enter'&&e.shiftKey){e.preventDefault();emailNode.current?.focus();}}} onKeyUp={e=>setCaps(e.getModifierState('CapsLock'))} onChange={e=>{setPassword(e.target.value);setFields(f=>({...f,password:undefined}));setError('');}}/><button type="button" className="auth-password-toggle" disabled={busy} aria-label={visible?'إخفاء كلمة المرور':'إظهار كلمة المرور'} aria-controls={id+'-password'} aria-pressed={visible} onClick={()=>{setVisible(v=>!v);passwordNode.current?.focus();}}><AuthIcon name={visible?'hidden':'eye'}/></button></div>{fields.password&&<small className="auth-field-error" id={id+'-password-error'}>{fields.password}</small>}{caps&&<small className="auth-caps" id={id+'-caps'} role="status">مفتاح Caps Lock مفعّل.</small>}</div>
   {!online&&<div className="auth-message auth-offline" role="status"><AuthIcon name="connection"/><p>أنت دون اتصال. يلزم الإنترنت لتسجيل الدخول{expectedOrganization?' وتجديد الجلسة':''}. أعد المحاولة عند عودة الاتصال.</p></div>}
   {error&&<div ref={errorNode} className="auth-message auth-error" role="alert" tabIndex={-1}><span aria-hidden="true">!</span><p>{error}</p></div>}
   <button className="auth-submit primary" type="submit" disabled={busy||!online}>{busy?<><span className="auth-spinner" aria-hidden="true"/>{phase==='workspace'?'جارٍ تحميل مساحة العمل…':'جارٍ التحقق من بيانات الدخول…'}</>:<>{expectedOrganization?'تجديد الجلسة والمتابعة':'تسجيل الدخول'}<AuthIcon name="arrow"/></>}</button><span className="auth-keyboard-hint">Enter للمتابعة · Ctrl / ⌘ + Enter للدخول</span>
  </form>
  <div className="auth-help"><button type="button" className="auth-help-toggle" disabled={busy} aria-expanded={help} aria-controls={id+'-help'} onClick={()=>setHelp(h=>!h)}>تحتاج مساعدة في الدخول؟<span aria-hidden="true">{help?'−':'+'}</span></button>{help&&<div id={id+'-help'}><p>استخدم البريد وكلمة المرور المخصّصين لك من مدير المؤسسة. إذا نسيت كلمة المرور أو لم يُفعّل حسابك، تواصل معه لاستعادة الوصول.</p></div>}</div>
  <p className="auth-footnote"><AuthIcon name="lock"/>{expectedOrganization?'استخدم حسابًا مخوّلًا للمؤسسة الحالية لمتابعة العمل.':'تسجيل الدخول يحتاج الإنترنت. يمكنك متابعة العمل على البيانات المحفوظة ضمن صلاحية جلستك.'}</p>
  {close&&<button className="secondary auth-return" type="button" disabled={busy} onClick={close}>العودة إلى مساحة العمل</button>}
 </div>;
}
export function SessionRenewal({organizationId,organizationName,close,renewed}:{organizationId:string;organizationName:string;close:()=>void;renewed:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 return <dialog ref={dialog} className="auth-renewal-dialog" aria-label="تجديد جلسة العمل" onCancel={event=>{event.preventDefault();if(dialog.current?.querySelector('[aria-busy="true"]'))return;close();}}><HostedLogin expectedOrganization={organizationId} organizationName={organizationName} close={close} signedIn={renewed}/></dialog>;
}
