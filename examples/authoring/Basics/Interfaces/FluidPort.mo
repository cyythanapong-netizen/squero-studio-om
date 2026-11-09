within Basics.Interfaces;
connector FluidPort
  "A fluid port: pressure and mass flow."

  Real p(unit = "Pa") "Pressure";
  flow Real m_flow(unit = "kg/s") "Mass flow into the component";

  annotation(
    Icon(graphics = {
      Ellipse(extent = {{-40, -40}, {40, 40}}, lineColor = {0, 0, 0}, fillColor = {255, 255, 255}, fillPattern = FillPattern.Solid),
      Ellipse(extent = {{-18, -18}, {18, 18}}, lineColor = {0, 0, 0}, fillColor = {255, 90, 31}, fillPattern = FillPattern.Solid)}),
    Documentation(info = "<html><p>A connector carries a potential (<code>p</code>) and a flow (<code>m_flow</code>).</p></html>"));
end FluidPort;
