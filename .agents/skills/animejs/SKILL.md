---
name: animejs
description: Use when building or documenting Anime.js v4 animations, timelines, draggables, layouts, scopes, and utilities in front-end projects.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [animejs, animation, frontend, javascript, waapi, svg, timeline, draggable, layout]
    related_skills: []
---

# Anime.js (v4) Skill

## Overview
Anime.js v4 provides modular JS and WAAPI-powered animation APIs with timelines, draggables, auto-layout transitions, scope-based lifecycle control, utilities, SVG/text helpers, and scroll-driven playback.

## When to Use
- Building DOM/SVG animations or interactive UI motion.
- Need a lightweight WAAPI alternative (waapi.animate) or full JS control (animate).
- Coordinating multiple animations with timelines or timers.
- Draggable UI elements or auto-layout transitions.
- Need per-target utilities (stagger, random, wrap, clamp, etc.).

Don’t use for:
- Heavy canvas/WebGL where you already control a render loop (use your own loop; optionally integrate with engine.update()).

## Core Imports
Main module (tree-shakeable with bundlers):
- import { animate, waapi, createTimeline, createTimer, createAnimatable, createDraggable, createLayout, createScope, utils, svg, text, events, eases, spring } from 'animejs'

Subpaths (granular):
- 'animejs/animation', 'animejs/waapi', 'animejs/timeline', 'animejs/timer', 'animejs/animatable', 'animejs/draggable', 'animejs/layout', 'animejs/scope', 'animejs/utils', 'animejs/svg', 'animejs/text', 'animejs/events', 'animejs/easings'

## Core Patterns
1) JS animate()
- animate(targets, { animatableProps, tweenParams, playbackSettings, callbacks })
- returns JSAnimation with methods (play/pause/seek/etc.)

2) WAAPI animate()
- waapi.animate(targets, { animatableProps, tweenParams, playbackSettings, callbacks })
- lighter bundle, hardware acceleration for some properties
- persist:false by default; set persist:true if you need methods after completion

3) Timeline
- createTimeline({ defaults, playbackSettings, callbacks })
- add animations/timers: timeline.add(targets, params, position)
- sync existing animations/timers/waapi: timeline.sync(instance, position)
- call functions: timeline.call(fn, position)
- time positions: absolute (100), relative ('+=100','-=100'), multiplier ('*=.5'), previous end ('<')

4) Timer
- createTimer({ playbackSettings, callbacks }) for synced time-based callbacks

5) Animatable (high-frequency updates)
- createAnimatable(targets, { properties settings })
- property methods become getters (no args) or setters (value, duration?, ease?)

6) Draggable
- createDraggable(target, { axes params, settings, callbacks })
- axes params: x/y (object or false), snap, modifier, mapTo
- settings: container, containerPadding, friction, releaseMass/stiffness/damping, velocity, dragSpeed, thresholds, cursor
- methods: enable/disable/setX/setY/reset/revert/refresh/animateInView/scrollInView

7) Layout (auto-layout transitions)
- createLayout(root, { children, properties, enterFrom/leaveTo/swapAt, callbacks })
- record() then DOM changes then animate(), or update(() => {...})

8) Scope
- createScope({ root, defaults, mediaQueries })
- add constructors/methods; revert() cleans all created instances

9) Text utilities
- splitText(target, params) returns TextSplitter
- scrambleText(params) returns function-based tween value for innerHTML

10) SVG utilities
- svg.morphTo(target, precision)
- svg.createDrawable(target) -> proxy with draw = 'start end'
- svg.createMotionPath(path, offset) -> translateX/translateY/rotate tween params

11) Utilities
- utils.$/get/set, stagger, random/createSeededRandom, clamp/snap/wrap/mapRange/lerp/damp, round/roundPad/padStart/padEnd, shuffle/randomPick, keepTime, sync
- chainable utility functions: call without value, then chain round/clamp/snap/wrap/mapRange/interpolate/degToRad/radToDeg/padStart/padEnd/roundPad

12) Events
- onScroll(): returns ScrollObserver; can be used in autoplay: onScroll(params)

## Tween & Playback Cheat Sheet
Tween parameters (global or per-property): to/from, delay, duration, ease, composition (JS), modifier (JS)
Playback settings: delay, duration, loop, loopDelay (JS), alternate, reversed, autoplay, frameRate (JS), playbackRate, playbackEase (JS), persist (WAAPI)

## Value Types
- Numbers/strings with units; unit inheritance in JS
- Relative values: '+=', '-=', '*=' (JS)
- Colors: HEX/HEXA/RGB/RGBA/HSL/HSLA; named colors (WAAPI)
- CSS variables: var(--x) (JS requires refresh() to pick new values)
- Function-based values per target (refresh() recomputes)

## Common Pitfalls
1) Performance: prefer opacity/transform; heavy layout properties can cause jank.
2) WAAPI persistence: completed WAAPI animations are released unless persist:true.
3) CSS variables with JS animate(): update value then call refresh() to re-read.
4) Unit conversions in JS can be inconsistent; set unit first with utils.set() or use WAAPI.
5) Composition: replace can pause existing animations; choose none/blend as needed.
6) Layout gotcha: non-target descendants can fade when sizes change; include them in children or set swapAt.opacity=1.
7) Draggable refresh: function-based params require .refresh() after resize.

## Verification Checklist
- Imports are from main module or correct subpath.
- Target types are valid (selector/element/object/array).
- For WAAPI, persist set if you need post-completion methods.
- For CSS variables in JS, refresh() when values change.
- For heavy UI, prefer transforms/opacity and consider engine.fps adjustments.
- If using scope, ensure revert() is called on cleanup.
