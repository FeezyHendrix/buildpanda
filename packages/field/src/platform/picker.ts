export function pickFiles({ accept, multiple, camera }: {
    accept: string;
    multiple?: boolean;
    camera?: boolean;
}): Promise<File[]> { return new Promise(resolve => { const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.multiple = Boolean(multiple); if (camera)
    input.setAttribute('capture', 'environment'); input.hidden = true; document.body.append(input); const finish = (files: File[]) => { input.remove(); resolve(files); }; input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true }); input.addEventListener('cancel', () => finish([]), { once: true }); input.click(); }); }
