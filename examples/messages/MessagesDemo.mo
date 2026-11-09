model MessagesDemo
  "Intentionally broken, to show error, warning and info cards.
   Open this file, then choose Model > Check Model (or press Ctrl+Shift+C).
   The Console's messages tab shows the cards; the console tab shows omc's log."

  // A package version older than the one Studio loads. omc warns for each entry:
  // these two warnings have no source line, so their cards have no location link.
  annotation(uses(Modelica(version = "3.2.3"), ModelicaServices(version = "3.2.0")));

  // The duplicate `start` is one defect omc reports twice: an Error on the first value and
  // a Notification ("From here") on the second. That is the one error and one info card.
  Real x(start = 1, start = 2);

equation
  x = 1;
end MessagesDemo;
