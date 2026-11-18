import { pickFiles } from './picker';
export type DocumentPickerAsset = {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    file: File;
};
export async function getDocumentAsync({ type = '*/*', multiple = false }: {
    type?: string | string[];
    multiple?: boolean;
    copyToCacheDirectory?: boolean;
} = {}) { const files = await pickFiles({ accept: Array.isArray(type) ? type.join(',') : type, multiple }); return { canceled: files.length === 0, assets: files.map(file => ({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type, size: file.size, file })) }; }
