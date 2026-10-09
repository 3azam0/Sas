export function backupDatabase(source:string,destination:string):{version:number;service:string;createdAt:string;files:Array<{name:string;sha256:string}>};
export function restoreDatabase(backup:string,destination:string):ReturnType<typeof backupDatabase>;
