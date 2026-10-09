import {create} from 'zustand';
export type View='overview'|'inventory'|'activity'|'sync';
export const useUI=create<{view:View;location:string;search:string;setView:(v:View)=>void;setLocation:(v:string)=>void;setSearch:(v:string)=>void}>(set=>({view:'overview',location:'central',search:'',setView:view=>set({view}),setLocation:location=>set({location}),setSearch:search=>set({search})}));
