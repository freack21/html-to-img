import { useState } from "react";
import { Field, Input, Select, Textarea, Toggle } from "./ui.jsx";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const COLOR_HEX = /^#[0-9a-f]{6}$/i;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function ImageInput({ value, onChange }) {
  const [error, setError] = useState(null);
  const isDataUri = value?.startsWith("data:");

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("Image must be 5 MB or smaller");
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return setError("Use PNG, JPEG, GIF or WebP");
    setError(null);
    onChange(await readAsDataUrl(file));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://… or upload"
          value={isDataUri ? "" : value}
          disabled={isDataUri}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800">
          Upload
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={onFile} />
        </label>
      </div>
      {isDataUri && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <img src={value} alt="" className="size-8 rounded object-cover" />
          Uploaded image
          <button type="button" className="text-red-600 hover:underline" onClick={() => onChange("")}>
            Remove
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ParamInput({ spec, value, onChange }) {
  switch (spec.type) {
    case "string":
      return spec.multiline ? (
        <Textarea rows={3} maxLength={spec.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input maxLength={spec.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
      );
    case "number":
      return (
        <Input
          type="number"
          min={spec.min}
          max={spec.max}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "color":
      return (
        <div className="flex gap-2">
          <input
            type="color"
            className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
            value={COLOR_HEX.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "boolean":
      return <Toggle checked={Boolean(value)} onChange={onChange} />;
    case "enum":
      return (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      );
    case "image":
      return <ImageInput value={value ?? ""} onChange={onChange} />;
    default:
      return null;
  }
}

export function defaultValues(params) {
  return Object.fromEntries(Object.entries(params).map(([name, spec]) => [name, spec.default ?? ""]));
}

/** Form generated from a template's param specs. */
export default function ParamForm({ params, values, onChange, errors = {} }) {
  return (
    <div className="space-y-4">
      {Object.entries(params).map(([name, spec]) => (
        <Field key={name} label={spec.label || name} hint={spec.description} error={errors[name]}>
          <ParamInput spec={spec} value={values[name] ?? ""} onChange={(v) => onChange({ ...values, [name]: v })} />
        </Field>
      ))}
    </div>
  );
}
