export default function BuildVersion(){return <small className="build-version" dir="ltr" data-testid="build-version">Fodo {process.env.NEXT_PUBLIC_FODO_BUILD||'development'}</small>;}
