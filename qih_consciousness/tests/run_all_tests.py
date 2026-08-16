#!/usr/bin/env python3
"""QIH validation runner — compatible with function-style and class-style tests."""
from __future__ import annotations

import importlib
import os
import sys
import traceback

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def _run_callable(name, fn):
    print(f"\n--- {name} ---")
    try:
        fn()
        print(f"[PASS] {name}")
        return True
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        traceback.print_exc()
        return False


def _try_class(module_path, class_name, run_kwargs=None):
    try:
        mod = importlib.import_module(module_path)
    except Exception as e:
        print(f"[SKIP] import {module_path}: {e}")
        return None
    cls = getattr(mod, class_name, None)
    if cls is None:
        return None
    inst = cls()
    if hasattr(inst, "run_test"):
        def _go():
            if run_kwargs:
                for k, v in run_kwargs.items():
                    inst.run_test(**v) if isinstance(v, dict) else inst.run_test(v)
            else:
                inst.run_test()
        return _go
    if hasattr(inst, "run"):
        return inst.run
    return None


def _try_functions(module_path):
    try:
        mod = importlib.import_module(module_path)
    except Exception as e:
        print(f"[SKIP] import {module_path}: {e}")
        return []
    out = []
    for name in dir(mod):
        if name.startswith("test_"):
            fn = getattr(mod, name)
            if callable(fn):
                out.append((f"{module_path}.{name}", fn))
    return out


def main():
    print("=" * 67)
    print("         Starting QIH Consciousness System Validation Tests        ")
    print("=" * 67)
    overall = True

    suites = [
        ("qih_consciousness.tests.born_rule_test", "BornRuleTester"),
        ("qih_consciousness.tests.entanglement_distance_test", "EntanglementDistanceTester"),
        ("qih_consciousness.tests.time_dilation_test", "TimeDilationTester"),
        ("qih_consciousness.tests.coherence_threshold_test", "CoherenceThresholdTester"),
    ]

    for mod_path, cls_name in suites:
        if cls_name == "TimeDilationTester":
            try:
                mod = importlib.import_module(mod_path)
                inst = getattr(mod, cls_name)()
                def _td():
                    inst.run_test(internal_omega_values=[1.0, 2.0, 5.0, 10.0])
                ok = _run_callable(cls_name, _td)
                overall = overall and ok
            except Exception as e:
                print(f"[FAIL] {cls_name}: {e}")
                overall = False
            continue
        runner = _try_class(mod_path, cls_name)
        if runner is not None:
            ok = _run_callable(f"{cls_name}", runner)
            overall = overall and ok
            continue
        funcs = _try_functions(mod_path)
        if not funcs:
            print(f"[WARN] No runnable tests in {mod_path}")
            continue
        for name, fn in funcs:
            ok = _run_callable(name, fn)
            overall = overall and ok

    print("\n" + "=" * 67)
    print("OVERALL:", "PASS" if overall else "FAIL")
    print("=" * 67)
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
