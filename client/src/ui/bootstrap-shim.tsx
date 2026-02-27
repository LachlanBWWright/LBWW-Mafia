import React from "react";

type AsPropProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  to?: string;
  disabled?: boolean;
  [key: string]: unknown;
};

const renderWithAs = (
  defaultTag: React.ElementType,
  { as: AsComponent, children, to, ...props }: AsPropProps,
) => {
  const Tag = AsComponent ?? defaultTag;
  return <Tag {...props} to={to}>{children}</Tag>;
};

export const Card = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);
Card.displayName = "Card";
Card.Body = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);
Card.Title = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <h3 {...props}>{children}</h3>
);
Card.Text = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <p {...props}>{children}</p>
);

export const Button = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <button type="button" {...props}>{children}</button>
);

export const Tooltip = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const OverlayTrigger = ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => <>{children}</>;

export const ListGroup = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);
ListGroup.Item = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const Row = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const Col = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const ButtonGroup = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const Navbar = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <nav {...props}>{children}</nav>
);
Navbar.Brand = (props: AsPropProps) => renderWithAs("a", props);
Navbar.Toggle = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <button type="button" {...props}>{children}</button>
);
Navbar.Collapse = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);

export const Nav = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => (
  <div {...props}>{children}</div>
);
Nav.Link = (props: AsPropProps) => renderWithAs("a", props);

export const Form = ({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => (
  <form {...props}>{children}</form>
);
Form.Control = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input {...props} ref={ref} />,
);
