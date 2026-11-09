within Basics;
model Tank
  "A tank whose level follows the net flow."

  parameter Real area(unit = "m2") = 1 "Cross-section";
  parameter Real rho(unit = "kg/m3") = 998 "Density";
  Interfaces.FluidPort port;
  Real level(start = 0.5, fixed = true) "Level";

equation
  der(level) = port.m_flow / (area * rho);
  port.p = 100000 + rho * 9.81 * level;

  annotation(
    Icon(graphics = {
      Rectangle(extent = {{-50, -60}, {50, 60}}, lineColor = {0, 0, 0}, fillColor = {242, 242, 239}, fillPattern = FillPattern.Solid),
      Rectangle(extent = {{-46, -56}, {46, 0}}, lineColor = {0, 0, 0}, fillColor = {214, 231, 242}, fillPattern = FillPattern.Solid),
      Line(points = {{50, 0}, {100, 0}}, color = {0, 0, 0})}),
    Documentation(info = "<html><p>The tank integrates the flow into a level; the level sets the pressure.</p></html>"));
end Tank;
