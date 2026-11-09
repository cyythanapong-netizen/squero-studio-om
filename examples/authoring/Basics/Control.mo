within Basics;
model Control
  "The block and the function together."

  Gain gain(k = 2);
  Real T(start = 300, fixed = true) "Temperature";
  Real p "Saturation pressure";

equation
  gain.u = T;
  p = Saturation(T);

  annotation(Documentation(info = "<html><p>A model that instantiates a block and calls a function.</p></html>"));
end Control;
