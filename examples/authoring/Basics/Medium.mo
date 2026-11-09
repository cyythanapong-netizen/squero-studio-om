within Basics;
record Medium
  "Water at a fixed density."

  parameter Real rho(unit = "kg/m3") = 998 "Density";
  parameter Real cp(unit = "J/(kg.K)") = 4180 "Specific heat capacity";

  annotation(Documentation(info = "<html><p>A record: parameters shared by the components.</p></html>"));
end Medium;
