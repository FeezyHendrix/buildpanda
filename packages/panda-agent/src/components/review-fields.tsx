import { useState } from "react";
import { htmlFromText } from "@buildpanda/rich-content";
import { Button } from "@field-ui/button";
import { INPUT_BASE_CLASS, Input } from "@field-ui/input";
import type { ToolSchema, UploadedFile } from "../api/tool-types";
import type { ReviewFieldProps } from "./review-field-types";
import { fieldHint, htmlMirror, initialValue, schemaTypes, selectedVariant, sourcedHint, titleCase, toolOptions } from "./review-schema";
import { ReviewFile, ReviewRichText } from "./review-upload";

function text(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function fileField(name: string) { return /^(?:fileIds?|.*FileIds?)$/.test(name); }
function labelOf(props: ReviewFieldProps) { return `${props.hint?.label ?? titleCase(props.name)}${props.required ? "" : " (optional)"}`; }

function ObjectFields(props: ReviewFieldProps) {
  const { schema, value, path, context, onChange } = props;
  const [newKey, setNewKey] = useState("");
  const payload = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const properties = schema.properties ?? {};
  const patch = (key: string, next: unknown) => {
    const result = { ...payload };
    if (next === undefined) delete result[key]; else result[key] = next;
    onChange(result);
  };
  const childPath = (key: string) => path ? `${path}.${key}` : key;
  const mirrors = new Set(Object.keys(properties).flatMap((key) => htmlMirror(properties, key, fieldHint(context.descriptor.fields, childPath(key))) ?? []));
  const names = [...new Set([...Object.keys(properties), ...Object.keys(payload)])].filter((name) => !mirrors.has(name));
  const dynamic = typeof schema.additionalProperties === "object" ? schema.additionalProperties : undefined;
  return <div className="space-y-5">
    {names.map((name) => {
      const field = properties[name] ?? dynamic;
      if (!field) return <div key={name}><p role="alert" className="text-sm text-danger-600">Unsupported field: {titleCase(name)}. Refresh this review before saving.</p>{path === "responses" ? <Button type="button" variant="ghost" disabled={context.disabled} onClick={() => patch(name, undefined)}>Remove this answer</Button> : null}</div>;
      const hint = sourcedHint(fieldHint(context.descriptor.fields, childPath(name)), payload);
      const required = schema.required?.includes(name) === true;
      const htmlKey = htmlMirror(properties, name, hint);
      const label = `${hint?.label ?? titleCase(name)}${required ? "" : " (optional)"}`;
      const isHtml = /Html$/.test(name) && schemaTypes(field).includes("string");
      return <div key={name} className="space-y-2">
        {htmlKey || isHtml ? <>
          <p className="text-sm font-medium">{label}</p>
          <ReviewRichText projectId={context.projectId} disabled={context.disabled} label={label} images={hint?.images !== false && context.catalog.uploads === true}
            value={typeof payload[htmlKey ?? name] === "string" ? payload[htmlKey ?? name] as string : htmlFromText(text(payload[name]))}
            onPending={context.onPending} onChange={(html, plain) => onChange({ ...payload, [name]: isHtml ? html : plain, ...(htmlKey ? { [htmlKey]: html } : {}) })} />
        </> : <ReviewField schema={field} name={name} path={childPath(name)} hint={hint} value={payload[name]} required={required} context={context} onChange={(next) => patch(name, next)}
          onFile={(file: UploadedFile) => {
            const next: Record<string, unknown> = { ...payload, [name]: file.id };
            if (name === "fileId" && properties.url && properties.name) {
              Object.assign(next, { url: `/files/${encodeURIComponent(file.id)}/download`, name: file.fileName });
              if (properties.mime) next.mime = file.mimeType;
              if (properties.size) next.size = file.sizeBytes;
            }
            onChange(next);
          }} />}
        {!required && payload[name] !== undefined ? <Button type="button" variant="ghost" size="sm" disabled={context.disabled} onClick={() => {
          const next = { ...payload }; delete next[name]; if (htmlKey) delete next[htmlKey]; onChange(next);
        }}>Remove {hint?.label ?? titleCase(name)}</Button> : null}
      </div>;
    })}
    {dynamic ? <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
      <label className="grow text-sm font-medium">Field name<Input className="mt-2" aria-label={`${props.name} field name`} value={newKey} disabled={context.disabled} onChange={(event) => setNewKey(event.target.value)} /></label>
      <Button type="button" variant="secondary" disabled={context.disabled || !newKey.trim() || newKey in payload || ["__proto__", "constructor", "prototype"].includes(newKey.trim())} onClick={() => { patch(newKey.trim(), initialValue(dynamic)); setNewKey(""); }}>Add field</Button>
    </div> : null}
  </div>;
}

export function ReviewField(props: ReviewFieldProps) {
  const { schema, value, name, path, required, context, hint, onChange } = props;
  const label = labelOf(props);
  const declared = schemaTypes(schema);
  const variants = !declared.length && !schema.properties ? schema.oneOf ?? schema.anyOf : undefined;
  const nonNull = declared.filter((type) => type !== "null");
  if (variants || nonNull.length > 1) {
    const choices = variants ?? declared.map((type) => ({ ...schema, type }));
    const selected = selectedVariant(choices, value);
    return <div className="space-y-3"><label className="block text-sm font-medium">{label}
      <select aria-label={`${label} type`} className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} disabled={context.disabled} value={selected < 0 ? "" : selected} onChange={(event) => { if (event.target.value !== "") onChange(initialValue(choices[Number(event.target.value)]!)); }}>
        <option value="">Choose value type</option>
        {choices.map((choice, index) => <option key={index} value={index}>{String(choice.const ?? Object.values(choice.properties ?? {}).find((property) => property.const !== undefined)?.const ?? schemaTypes(choice).join(" / "))}</option>)}
      </select>
    </label>{selected >= 0 ? <ReviewField {...props} schema={choices[selected]!} /> : null}</div>;
  }
  if (schema.const !== undefined) return <Input aria-label={label} value={String(schema.const)} readOnly />;
  const type = nonNull[0] ?? declared[0];
  if (type === "object") {
    if (value == null && !required) return <Button type="button" variant="secondary" disabled={context.disabled} onClick={() => onChange(initialValue(schema))}>Add {hint?.label ?? titleCase(name)}</Button>;
    return <fieldset disabled={context.disabled} className={path ? "space-y-4 rounded-lg border border-line p-4" : "space-y-4"}>
      {path ? <legend className="px-1 text-sm font-semibold">{label}</legend> : null}<ObjectFields {...props} />
    </fieldset>;
  }
  if (type === "array" && schema.items) {
    const values = Array.isArray(value) ? value : [];
    return <fieldset disabled={context.disabled} className="space-y-3 rounded-lg border border-line p-4"><legend className="px-1 text-sm font-medium">{label}</legend>
      {values.map((item, index) => <div key={index} className="space-y-2 border-b border-line pb-3">
        <ReviewField {...props} schema={schema.items!} value={item} name={name} path={`${path}.${index}`} required hint={{ ...hint, name, type: hint?.type ?? "text", label: `${hint?.label ?? titleCase(name)} ${index + 1}` }} onChange={(next) => onChange(values.map((entry, position) => position === index ? next : entry))} onFile={(file) => onChange(values.map((entry, position) => position === index ? file.id : entry))} />
        <Button type="button" variant="ghost" size="sm" disabled={context.disabled} onClick={() => onChange(values.filter((_, position) => position !== index))}>Remove item {index + 1}</Button>
      </div>)}
      <Button type="button" variant="secondary" disabled={context.disabled || (schema.maxItems !== undefined && values.length >= schema.maxItems)} onClick={() => onChange([...values, initialValue(schema.items!)])}>Add {hint?.label ?? titleCase(name)} item</Button>
    </fieldset>;
  }
  const options = toolOptions(context.catalog, hint?.source);
  const choices = schema.enum ?? hint?.choices;
  if (fileField(name) || hint?.type === "file") return <div className="space-y-2"><p className="text-sm font-medium">{label}</p><ReviewFile projectId={context.projectId} disabled={context.disabled} uploads={context.catalog.uploads === true} options={toolOptions(context.catalog, "files")} label={label} value={value} onPending={context.onPending} onChange={props.onFile ?? ((file) => onChange(file.id))} /></div>;
  if (choices || hint?.source || type === "boolean") {
    const values = choices ?? (type === "boolean" ? [true, false, ...(declared.includes("null") ? [null] : [])] : options.map((item) => item.value));
    const selected = values.findIndex((item) => item === value);
    return <label className="block text-sm font-medium">{label}<select aria-label={label} className={`${INPUT_BASE_CLASS} mt-2 min-h-12 px-3`} value={selected < 0 ? "" : selected} disabled={context.disabled} onChange={(event) => onChange(event.target.value === "" ? undefined : values[Number(event.target.value)])}>
      <option value="">{value !== undefined && selected < 0 ? "Current selection (refresh to choose another)" : "Choose value"}</option>
      {values.map((item, index) => <option key={index} value={index}>{options.find((option) => option.value === item)?.label ?? (item === true ? "Yes" : item === false ? "No" : item === null ? "Clear value" : String(item))}</option>)}
    </select>{hint?.source && !options.length ? <span className="mt-2 block text-xs text-ink-muted">No authorized choices are available. Refresh the conversation to check your access.</span> : null}</label>;
  }
  if (type === "null") return <p className="text-sm text-ink-muted">{label}: cleared</p>;
  const multiline = hint?.type === "long_text" || hint?.type === "rich_text" || (schema.maxLength ?? 0) > 500;
  const numeric = type === "number" || type === "integer";
  const date = hint?.type === "date" || schema.format === "date" || schema.pattern === "^\\d{4}-\\d{2}-\\d{2}$";
  return <label className="block text-sm font-medium">{label}{multiline && !numeric ? <textarea aria-label={label} className={`${INPUT_BASE_CLASS} mt-2 min-h-28 resize-y p-4`} value={text(value)} disabled={context.disabled} maxLength={schema.maxLength} onChange={(event) => onChange(event.target.value)} />
    : <Input aria-label={label} className="mt-2" type={numeric ? "number" : date ? "date" : "text"} step={type === "integer" ? "1" : typeof schema["x-decimalPlaces"] === "number" ? 10 ** -schema["x-decimalPlaces"] : "any"} min={schema.minimum} max={schema.maximum} maxLength={schema.maxLength} value={text(value)} disabled={context.disabled} onChange={(event) => onChange(numeric ? event.target.value === "" ? undefined : Number(event.target.value) : event.target.value)} />}
    {numeric && typeof schema["x-decimalPlaces"] === "number" ? <span className="mt-2 block text-xs text-ink-muted">Up to {schema["x-decimalPlaces"]} decimal places.</span> : null}
    {hint?.helpText ? <span className="mt-2 block text-xs text-ink-muted">{hint.helpText}</span> : null}
  </label>;
}

export function GenericReviewFields({ schema, payload, context, onChange }: { schema: ToolSchema; payload: Record<string, unknown>; context: ReviewFieldProps["context"]; onChange: (payload: Record<string, unknown>) => void }) {
  return <ReviewField schema={schema} value={payload} name="Action" path="" required context={context} onChange={(next) => onChange(next as Record<string, unknown>)} />;
}
