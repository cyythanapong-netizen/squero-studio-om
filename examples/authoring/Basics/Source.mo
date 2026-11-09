within Basics;
model Source
  "A fixed-pressure source."

  parameter Real p0(unit = "Pa") = 100000 "Pressure";
  Interfaces.FluidPort port;

equation
  port.p = p0;

  annotation(
    Icon(graphics = {
      Rectangle(extent = {{-60, -40}, {60, 40}}, lineColor = {0, 0, 0}, fillColor = {242, 242, 239}, fillPattern = FillPattern.Solid),
      Text(extent = {{-50, 20}, {50, -20}}, lineColor = {0, 0, 0}, textString = "p0"),
      Line(points = {{60, 0}, {100, 0}}, color = {0, 0, 0})}),
    Documentation(info = "<html><p>A source holds its port at <code>p0</code>; the flow follows the loop.</p></html>"));
end Source;
