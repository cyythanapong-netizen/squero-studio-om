// Domain colour coding, lightly after OpenModelica's: signals navy, electrical blue, rotational
// grey, translational green, thermal red, fluid cyan, magnetic orange. A part takes its colour from
// its class path; a causal port is a signal whatever the part.

const DOMAINS: [string, string][] = [
  ["Modelica.Blocks.", "signal"],
  ["Modelica.Electrical.", "electrical"],
  ["Modelica.Mechanics.Rotational.", "rotational"],
  ["Modelica.Mechanics.Translational.", "translational"],
  ["Modelica.Mechanics.MultiBody.", "multibody"],
  ["Modelica.Thermal.", "thermal"],
  ["Modelica.Fluid.", "fluid"],
  ["Modelica.Magnetic.", "magnetic"],
  ["Modelica.StateGraph.", "signal"],
  ["Modelica.Clocked.", "signal"],
];

/** The domain of a class by its path, or undefined for one that has none (a user's own class). */
export const domainOf = (cls: string): string | undefined => DOMAINS.find(([prefix]) => cls.startsWith(prefix))?.[1];

/** A CSS colour for a domain, or undefined to leave the default ink. */
export const domainColor = (domain: string | undefined) => (domain ? `var(--dom-${domain})` : undefined);
