within Basics;
block Gain
  "A causal gain block."

  parameter Real k = 2 "Gain";
  input Real u "Input";
  output Real y "Output";

equation
  y = k * u;

  annotation(
    Icon(graphics = {
      Rectangle(extent = {{-60, -40}, {60, 40}}, lineColor = {0, 0, 0}, fillColor = {242, 242, 239}, fillPattern = FillPattern.Solid),
      Text(extent = {{-50, 20}, {50, -20}}, lineColor = {0, 0, 0}, textString = "k"),
      Line(points = {{-100, 0}, {-60, 0}}, color = {0, 0, 0}),
      Line(points = {{60, 0}, {100, 0}}, color = {0, 0, 0})}),
    Documentation(info = "<html><p>A block: inputs and outputs, no acausal connectors.</p></html>"));
end Gain;
