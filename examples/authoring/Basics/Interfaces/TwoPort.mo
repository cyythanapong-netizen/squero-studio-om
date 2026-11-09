within Basics.Interfaces;
partial model TwoPort
  "A base for components with an inlet and an outlet."

  FluidPort port_a;
  FluidPort port_b;

equation
  port_a.m_flow + port_b.m_flow = 0;

  annotation(Documentation(info = "<html><p>Subclasses add the pressure relation and the flow.</p></html>"));
end TwoPort;
