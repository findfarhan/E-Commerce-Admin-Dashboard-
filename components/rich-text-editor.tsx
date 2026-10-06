"use client";

import {useEffect,useRef,useState} from "react";

type Command="bold"|"italic"|"insertUnorderedList"|"insertOrderedList"|"formatBlock"|"removeFormat"|"undo"|"redo";

export function RichTextEditor({
  name,
  value="",
  placeholder="Write the product story, design intent, materials, care details and useful customer context…",
}:{
  name:string;
  value?:string;
  placeholder?:string;
}){
  const editorRef=useRef<HTMLDivElement|null>(null);
  const [html,setHtml]=useState(value);

  useEffect(()=>{
    if(editorRef.current&&editorRef.current.innerHTML!==value){
      editorRef.current.innerHTML=value;
      setHtml(value);
    }
  },[value]);

  const sync=()=>{
    const next=editorRef.current?.innerHTML||"";
    setHtml(next==="<br>"?"":next);
  };

  const run=(command:Command,arg?:string)=>{
    editorRef.current?.focus();
    document.execCommand(command,false,arg);
    queueMicrotask(sync);
  };

  const link=()=>{
    editorRef.current?.focus();
    const href=window.prompt("Paste a URL");
    if(!href) return;
    document.execCommand("createLink",false,href);
    queueMicrotask(sync);
  };

  const button=(label:string,onClick:()=>void,title:string)=>
    <button type="button" title={title} aria-label={title} onMouseDown={event=>{event.preventDefault();onClick();}}>{label}</button>;

  return <div className="rich-editor">
    <input type="hidden" name={name} value={html}/>
    <div className="rich-editor-toolbar" role="toolbar" aria-label="Product description formatting">
      <select
        aria-label="Text style"
        defaultValue="p"
        onChange={event=>run("formatBlock",event.target.value)}
      >
        <option value="p">Paragraph</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="blockquote">Quote</option>
      </select>
      <span className="rich-editor-divider"/>
      {button("B",()=>run("bold"),"Bold")}
      {button("I",()=>run("italic"),"Italic")}
      {button("• List",()=>run("insertUnorderedList"),"Bullet list")}
      {button("1. List",()=>run("insertOrderedList"),"Numbered list")}
      {button("Link",link,"Add link")}
      <span className="rich-editor-divider"/>
      {button("↶",()=>run("undo"),"Undo")}
      {button("↷",()=>run("redo"),"Redo")}
      {button("Clear",()=>run("removeFormat"),"Clear formatting")}
    </div>
    <div
      ref={editorRef}
      className="rich-editor-canvas"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      dangerouslySetInnerHTML={{__html:value}}
      onInput={sync}
      onBlur={sync}
    />
    <div className="rich-editor-footer">
      <span>Rich product description</span>
      <span>Safe HTML is sanitized by the commerce API before saving</span>
    </div>
  </div>;
}
