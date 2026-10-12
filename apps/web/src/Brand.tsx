export const brandLogo='/branding/foodo-logo-v1.png';
export const brandIcon='/branding/foodo-icon-v1.png';

export default function Brand({tagline='إدارة المطاعم، ببساطة'}:{tagline?:string}){
 return <div className="brand-line foodo-brand"><img className="foodo-logo" src={brandLogo} width="2172" height="724" alt="FooDo"/><span className="foodo-tagline" dir="rtl">{tagline}</span></div>;
}

export function BrandMark(){
 return <img className="foodo-mark" src={brandIcon} width="1254" height="1254" alt="" aria-hidden="true"/>;
}
