'use client';
import {useEffect,useRef,useState} from 'react';
import type {Snapshot} from '@saas/contracts';

export function OrganizationIdentity({snapshot}:{snapshot:Snapshot}){
 const profile=snapshot.organizationProfile;
 return <div className="organization-identity">
  {profile?.logoPath&&<img className="organization-logo" src={profile.logoPath} alt={`شعار ${snapshot.organizationName}`} width="64" height="64"/>}
  <div><strong>{snapshot.organizationName}</strong><span className="tiny">{[profile?.businessType||'مطاعم',profile?.city,profile?.country||'مصر'].filter(Boolean).join(' · ')}</span></div>
 </div>;
}

function OrganizationContact({snapshot}:{snapshot:Snapshot}){
 const profile=snapshot.organizationProfile;if(!profile||!Object.keys(profile).length)return null;
 return <section className="panel organization-details" aria-label="بيانات المؤسسة">
  <div className="organization-details-heading">
   {profile.logoPath&&<img className="organization-profile-logo" src={profile.logoPath} alt={`شعار ${snapshot.organizationName}`} width="112" height="112"/>}
   <div><span className="eyebrow">بيانات المؤسسة</span><h2>{snapshot.organizationName}</h2>{profile.nameEn&&<p dir="ltr">{profile.nameEn}</p>}</div>
  </div>
  <dl className="organization-contact-grid">
   {profile.address&&<div className="organization-address"><dt>العنوان</dt><dd>{profile.address}</dd></div>}
   {profile.phone&&<div><dt>الهاتف</dt><dd><a href={`tel:${profile.phone}`}><bdi>{profile.phone}</bdi></a></dd></div>}
   {profile.additionalPhone&&<div><dt>هاتف إضافي</dt><dd><a href={`tel:${profile.additionalPhone}`}><bdi>{profile.additionalPhone}</bdi></a></dd></div>}
   {profile.email&&<div><dt>البريد الإلكتروني</dt><dd><a href={`mailto:${profile.email}`}><bdi>{profile.email}</bdi></a></dd></div>}
  </dl>
  {(profile.whatsapp||profile.mapUrl||profile.facebookUrl)&&<div className="organization-links">
   {profile.whatsapp&&<a className="secondary" href={`https://wa.me/${profile.whatsapp.slice(1)}`} target="_blank" rel="noopener noreferrer">واتساب</a>}
   {profile.mapUrl&&<a className="secondary" href={profile.mapUrl} target="_blank" rel="noopener noreferrer">الموقع على الخريطة</a>}
   {profile.facebookUrl&&<a className="secondary" href={profile.facebookUrl} target="_blank" rel="noopener noreferrer">صفحة فيسبوك</a>}
  </div>}
 </section>;
}

function OrganizationDialog({snapshot,close}:{snapshot:Snapshot;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);
 const finish=()=>{dialog.current?.close();close();};
 return <dialog ref={dialog} className="modal organization-dialog" aria-labelledby="organization-profile-title" onCancel={event=>{event.preventDefault();finish();}} onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)finish();}}>
  <div className="modal-header"><h2 id="organization-profile-title">بيانات المؤسسة</h2><button type="button" className="icon-button" aria-label="إغلاق بيانات المؤسسة" onClick={finish}>×</button></div>
  <div className="modal-body"><OrganizationContact snapshot={snapshot}/></div>
 </dialog>;
}

export default function OrganizationMenu({snapshot}:{snapshot:Snapshot}){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 return <><button ref={trigger} type="button" className="organization organization-trigger" aria-label="المؤسسة الحالية" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
  <span className="tiny">المؤسسة الحالية</span><OrganizationIdentity snapshot={snapshot}/>
 </button>{open&&<OrganizationDialog snapshot={snapshot} close={()=>{setOpen(false);trigger.current?.focus();}}/>}</>;
}
