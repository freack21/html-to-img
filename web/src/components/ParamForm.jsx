import { useState } from "react";
import { ColorPicker, Field, FilePicker, Input, NumberInput, Select, Textarea, Toggle } from "./ui.jsx";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

  const onFile = async (file) => {
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
        <FilePicker accept="image/png,image/jpeg,image/gif,image/webp" onFile={onFile} className="shrink-0" />
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
        <NumberInput min={spec.min} max={spec.max} value={value} onChange={onChange} />
      );
    case "color":
      return <ColorPicker value={value} onChange={onChange} />;
    case "boolean":
      return <Toggle checked={Boolean(value)} onChange={onChange} />;
    case "enum":
      return <Select value={value} onChange={onChange} options={spec.options} />;
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
