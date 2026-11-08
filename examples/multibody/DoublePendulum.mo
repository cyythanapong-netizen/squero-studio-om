model DoublePendulum "Double pendulum from two revolute joints and two box bodies (MSL MultiBody.Examples.Elementary.DoublePendulum)"
  inner Modelica.Mechanics.MultiBody.World world annotation(
    Placement(transformation(extent = {{-100, -10}, {-80, 10}})));
  Modelica.Mechanics.MultiBody.Joints.Revolute revolute1(useAxisFlange = true, phi(fixed = true), w(fixed = true)) annotation(
    Placement(transformation(extent = {{-60, -10}, {-40, 10}})));
  Modelica.Mechanics.Rotational.Components.Damper damper(d = 0.1) annotation(
    Placement(transformation(extent = {{-60, 30}, {-40, 50}})));
  Modelica.Mechanics.MultiBody.Parts.BodyBox boxBody1(r = {0.5, 0, 0}, width = 0.06) annotation(
    Placement(transformation(extent = {{-20, -10}, {0, 10}})));
  Modelica.Mechanics.MultiBody.Joints.Revolute revolute2(useAxisFlange = true, phi(fixed = true), w(fixed = true)) annotation(
    Placement(transformation(extent = {{20, -10}, {40, 10}})));
  Modelica.Mechanics.MultiBody.Parts.BodyBox boxBody2(r = {0.5, 0, 0}, width = 0.06) annotation(
    Placement(transformation(extent = {{60, -10}, {80, 10}})));
  Modelica.Blocks.Interfaces.RealInput tau1 "Torque at the upper joint" annotation(
    Placement(transformation(origin = {-120, 80}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Blocks.Interfaces.RealInput tau2 "Torque at the lower joint" annotation(
    Placement(transformation(origin = {-120, -60}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Mechanics.Rotational.Sources.Torque torque1 annotation(
    Placement(transformation(origin = {-80, 80}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Mechanics.Rotational.Sources.Torque torque2 annotation(
    Placement(transformation(origin = {0, 60}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Mechanics.Rotational.Sensors.AngleSensor angle1 annotation(
    Placement(transformation(origin = {-10, 80}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Mechanics.Rotational.Sensors.AngleSensor angle2 annotation(
    Placement(transformation(origin = {60, 60}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Blocks.Interfaces.RealOutput phi1 "Upper joint angle" annotation(
    Placement(transformation(origin = {120, 80}, extent = {{-10, -10}, {10, 10}})));
  Modelica.Blocks.Interfaces.RealOutput phi2 "Lower joint angle" annotation(
    Placement(transformation(origin = {120, 40}, extent = {{-10, -10}, {10, 10}})));
equation
  connect(tau1, torque1.tau);
  connect(torque1.flange, revolute1.axis);
  connect(tau2, torque2.tau);
  connect(torque2.flange, revolute2.axis);
  connect(revolute1.axis, angle1.flange);
  connect(revolute2.axis, angle2.flange);
  connect(angle1.phi, phi1);
  connect(angle2.phi, phi2);
  connect(damper.flange_b, revolute1.axis) annotation(
    Line(points = {{-40, 40}, {-40, 20}, {-50, 20}, {-50, 10}}));
  connect(revolute1.support, damper.flange_a) annotation(
    Line(points = {{-56, 10}, {-56, 20}, {-60, 20}, {-60, 40}}));
  connect(revolute1.frame_b, boxBody1.frame_a) annotation(
    Line(points = {{-40, 0}, {-20, 0}}, color = {95, 95, 95}, thickness = 0.5));
  connect(revolute2.frame_b, boxBody2.frame_a) annotation(
    Line(points = {{40, 0}, {60, 0}}, color = {95, 95, 95}, thickness = 0.5));
  connect(boxBody1.frame_b, revolute2.frame_a) annotation(
    Line(points = {{0, 0}, {20, 0}}, color = {95, 95, 95}, thickness = 0.5));
  connect(world.frame_b, revolute1.frame_a) annotation(
    Line(points = {{-80, 0}, {-60, 0}}, color = {95, 95, 95}, thickness = 0.5));
  annotation(experiment(StopTime = 3));
end DoublePendulum;
