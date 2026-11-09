within Basics;
function Saturation
  "A saturation pressure curve, for the example."

  input Real T(unit = "K") "Temperature";
  output Real p(unit = "Pa") "Saturation pressure";

algorithm
  p := 611.2 * exp(17.67 * (T - 273.15) / (T - 29.65));

  annotation(Documentation(info = "<html><p>A function with an algorithm section.</p></html>"));
end Saturation;
