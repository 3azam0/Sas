'use client';
import {useEffect,useState} from 'react';

export const deviceSelectionKey=(kind:'pos'|'kitchen',organization:string,generation?:string)=>'foodo:selection:'+JSON.stringify([kind,organization,generation??null]);
export function validDeviceSelection(saved:string|null,choices:string[]){return saved===null?(choices[0]??''):choices.includes(saved)?saved:'';}

// Device context is deliberately excluded from recovery and never selects a
// different terminal silently when a previously chosen one becomes unavailable.
export function useDeviceSelection(kind:'pos'|'kitchen',organization:string,generation:string|undefined,choices:string[]){
 const key=deviceSelectionKey(kind,organization,generation),signature=JSON.stringify(choices);
 const [selection,setSelection]=useState({key:'',value:''});
 useEffect(()=>{setSelection(current=>{
  if(current.key===key&&(current.value===''||choices.includes(current.value)))return current;
  let saved=current.key===key?current.value:null;
  try{saved=localStorage.getItem(key)??saved;}catch{}
  return {key,value:validDeviceSelection(saved,choices)};
 });},[key,signature]);
 function choose(value:string){if(value!==''&&!choices.includes(value))return;setSelection({key,value});try{localStorage.setItem(key,value);}catch{}}
 return [selection.key===key&&choices.includes(selection.value)?selection.value:'',choose,selection.key===key] as const;
}
