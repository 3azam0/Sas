import type {Metadata,Viewport} from 'next';
import './globals.css';
import './organization.css';
import './form-polish.css';
import './cost-control.css';
import './screen-polish.css';
import './brand.css';
import './kitchen-issues.css';
import './document-forms.css';
import './client-guide.css';
import './daily-workflow.css';
export const metadata:Metadata={title:'FooDo | إدارة المخزون والتكاليف',description:'إدارة المخزون والتكاليف والفروع والعمل دون اتصال',manifest:'/manifest.webmanifest',icons:{icon:'/branding/foodo-icon-v1.png',apple:'/branding/foodo-icon-v1.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#d94b20'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>;}

import './reports.css';
import './printing.css';
