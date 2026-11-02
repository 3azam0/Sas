'use client';
import type {Snapshot} from '@saas/contracts';
import Brand from './Brand';
import OrganizationMenu from './OrganizationDetails';

export default function SidebarIdentity({snapshot}:{snapshot:Snapshot}){
 return <div className="sidebar-identity">
  <details className="identity-disclosure" open><summary>شعار التطبيق<span aria-hidden="true">⌄</span></summary><Brand/></details>
  <details className="identity-disclosure" open><summary>المؤسسة<span aria-hidden="true">⌄</span></summary><OrganizationMenu snapshot={snapshot}/></details>
 </div>;
}
