export function csvCell(value){const text=String(value);const safe=/^[\s]*[=+\-@]/.test(text)?"'"+text:text;return '"'+safe.replaceAll('"','""')+'"';}
