import type { InputHTMLAttributes, ReactNode } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  wrapperClassName?: string;
  inputClassName?: string;
}

export default function FormField({
  label,
  icon,
  wrapperClassName,
  inputClassName = "form-input",
  id,
  ...inputProps
}: FormFieldProps) {
  const fieldId = id ?? inputProps.name ?? "field";

  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <div style={{ position: "relative" }}>
        {icon}
        <input id={fieldId} className={inputClassName} {...inputProps} />
      </div>
    </div>
  );
}
