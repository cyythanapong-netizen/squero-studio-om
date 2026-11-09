within Basics;
model Pump
  "A constant-speed pump with a fixed pressure rise."

  extends Interfaces.TwoPort;
  parameter Medium medium "The fluid";
  parameter Real speed(unit = "rev/min") = 2900 "Speed";
  parameter Real dP(unit = "Pa") = 200000 "Pressure rise";

equation
  port_b.p - port_a.p = dP;
  port_a.m_flow = medium.rho * speed * 1e-5;

  annotation(
    Icon(graphics = {
      Ellipse(extent = {{-45, -45}, {45, 45}}, lineColor = {0, 0, 0}, fillColor = {242, 242, 239}, fillPattern = FillPattern.Solid),
      Polygon(points = {{-18, -22}, {22, 0}, {-18, 22}, {-18, -22}}, lineColor = {0, 0, 0}, fillColor = {255, 90, 31}, fillPattern = FillPattern.Solid),
      Line(points = {{-100, 0}, {-45, 0}}, color = {0, 0, 0}),
      Line(points = {{45, 0}, {100, 0}}, color = {0, 0, 0})}),
    Documentation(info = "<html><p>A pump is a submodel: it extends the base and adds equations using the <code>Medium</code> record.</p></html>"));
end Pump;
