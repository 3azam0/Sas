import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Fodo | إدارة المخزون والتكاليف',description:'نموذج أولي لإدارة المطاعم والفروع والعمل دون اتصال',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#d94b20'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>;}
