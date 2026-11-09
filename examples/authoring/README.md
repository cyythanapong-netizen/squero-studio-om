# Basics: an authoring walkthrough

A small, self-contained package that exercises every class kind the authoring shell knows.

```sh
bin/squero-om examples/authoring/Basics/Loop.mo
```

## What to look at

- **Files rail**: `Basics` is a package, `Interfaces` a subpackage, and the tree lists a connector, a
  partial model, a record, a function, a block and models. `package.order` is in step.
- **Loop**: a top model with three submodels (`source`, `pump`, `tank`) wired through
  `Basics.Interfaces.FluidPort`. Open the diagram, then a component's popover.
- **Pump**: extends the partial `Interfaces.TwoPort` and uses the `Medium` record.
- **Control**: instantiates the `Gain` block and calls the `Saturation` function.
- **Docs**: every class carries a Documentation annotation.
- **New Class**: the rail's `+` defaults to `Basics`; create `Valve` and it lands in `package.order`.
- **Model ▸ Check Model**: `Loop`, `Pump` and `Control` check cleanly.

## Layout

```
Basics/
  Interfaces/
    FluidPort.mo    connector: pressure and mass flow
    TwoPort.mo      partial model: two ports, flow balance
  Medium.mo         record: density and heat capacity
  Saturation.mo     function: an algorithm
  Gain.mo           block: causal input and output
  Source.mo         model: fixed pressure
  Pump.mo           model: extends TwoPort, uses Medium
  Tank.mo           model: integrates the flow into a level
  Loop.mo           model: source + pump + tank
  Control.mo        model: block + function
```
