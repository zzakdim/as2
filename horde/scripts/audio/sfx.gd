class_name Sfx
extends Node
## Melee uses recorded CC0 sounds (assets/oga, assets/kenney); the rest is
## synthesized at startup. play3d()/play2d() take a
## name, so swapping in .ogg files later only touches _build().

const RATE := 22050

var sounds := {}      # name -> AudioStream, or Array of variants picked at random
const SAMPLE_SETS := {
	# CC0 Kenney recordings, layered over the synthesized whooshes.
	"slash": ["knifeSlice", "knifeSlice2", "chop"],
	"chop": ["impactPunch_medium_000", "impactPunch_medium_001", "impactPunch_medium_002", "impactPunch_medium_003", "impactPunch_medium_004"],
	"bone": ["impactPunch_heavy_000", "impactPunch_heavy_001", "impactPunch_heavy_002", "impactPunch_heavy_003", "impactPunch_heavy_004"],
	"flesh": ["impactSoft_heavy_000", "impactSoft_heavy_001", "impactSoft_heavy_002", "impactSoft_heavy_003", "impactSoft_heavy_004"],
	"melee_hit": ["impactSoft_medium_000", "impactSoft_medium_001", "impactSoft_medium_002", "impactSoft_medium_003", "impactSoft_medium_004"],
	"claw": ["impactPunch_medium_000", "impactPunch_medium_002", "impactPunch_medium_004"],
	"clank": ["impactMetal_heavy_000", "impactMetal_heavy_001", "impactMetal_heavy_002", "impactMetal_heavy_003", "impactMetal_heavy_004"],
	"block": ["impactPlate_medium_000", "impactPlate_medium_001", "impactPlate_medium_002", "impactPlate_medium_003", "impactPlate_medium_004"],
	"step": ["footstep_concrete_000", "footstep_concrete_001", "footstep_concrete_002", "footstep_concrete_003", "footstep_concrete_004"],
	"draw": ["drawKnife1", "drawKnife2"],
}
var _pool: Array = []
var _pool_i := 0
var _ui: Array = []
var _ui_i := 0
var music_ambient: AudioStreamPlayer
var music_tank: AudioStreamPlayer
var music_crescendo: AudioStreamPlayer
var _music_state := "ambient"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	_load_samples()
	_setup_buses()
	for i in 40:
		var p := AudioStreamPlayer3D.new()
		p.bus = "World"
		p.unit_size = 6.0
		p.max_distance = 70.0
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		p.panning_strength = 1.0
		add_child(p)
		_pool.append(p)
	for i in 8:
		var u := AudioStreamPlayer.new()
		add_child(u)
		_ui.append(u)
	music_ambient = _music_player("music_ambient", -14.0)
	music_tank = _music_player("music_tank", -80.0)
	music_crescendo = _music_player("alarm", -80.0)


## World sounds get a short room reverb; everything is glued by a gentle
## compressor and a limiter on the master so stacked hits don't clip.
func _setup_buses() -> void:
	if AudioServer.get_bus_index("World") >= 0:
		return
	AudioServer.add_bus()
	var wi := AudioServer.bus_count - 1
	AudioServer.set_bus_name(wi, "World")
	AudioServer.set_bus_send(wi, "Master")
	var rev := AudioEffectReverb.new()
	rev.room_size = 0.32
	rev.damping = 0.6
	rev.wet = 0.1
	rev.dry = 1.0
	rev.spread = 0.8
	AudioServer.add_bus_effect(wi, rev)
	var comp := AudioEffectCompressor.new()
	comp.threshold = -14.0
	comp.ratio = 3.0
	comp.attack_us = 4000.0
	comp.release_ms = 140.0
	AudioServer.add_bus_effect(0, comp)
	var lim := AudioEffectHardLimiter.new()
	lim.ceiling_db = -0.5
	AudioServer.add_bus_effect(0, lim)


func _music_player(n: String, db: float) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = _stream(n)
	p.volume_db = db
	add_child(p)
	return p


func start_music() -> void:
	for p in [music_ambient, music_tank, music_crescendo]:
		if not p.playing:
			p.play()


func stop_music() -> void:
	for p in [music_ambient, music_tank, music_crescendo]:
		p.stop()


func _process(delta: float) -> void:
	var t_amb := -14.0
	var t_tank := -80.0
	var t_cres := -80.0
	match _music_state:
		"tank":
			t_amb = -40.0
			t_tank = -6.0
		"crescendo":
			t_amb = -30.0
			t_cres = -10.0
		"quiet":
			t_amb = -40.0
	music_ambient.volume_db = move_toward(music_ambient.volume_db, t_amb, delta * 20.0)
	music_tank.volume_db = move_toward(music_tank.volume_db, t_tank, delta * 30.0)
	music_crescendo.volume_db = move_toward(music_crescendo.volume_db, t_cres, delta * 30.0)


func set_music(state: String) -> void:
	_music_state = state


# CC0/MIT OpenGameArt recordings (assets/oga/audio, see assets/README.md):
# name -> [file prefix, count]. These replace the synthesized whooshes and
# the generic impacts for melee.
const OGA_SETS := {
	"whoosh": ["swish_", 13], "whoosh_heavy": ["swish_heavy_", 13],
	"flesh_hit": ["flesh_", 22], "thump": ["thump_", 8], "gore": ["gore_", 5],
	"splat": ["splat_", 14], "clank": ["clash_", 10], "block": ["block_", 10],
	"blade_ring": ["blade_ring_", 10],
	# Older names other systems use.
	"chop": ["flesh_", 22], "slash": ["gore_", 5], "flesh": ["splat_", 14], "bone": ["thump_", 8],
	"melee_hit": ["thump_", 8], "claw": ["flesh_", 22],
}


func _load_samples() -> void:
	for n in SAMPLE_SETS:
		var arr: Array = []
		for f in SAMPLE_SETS[n]:
			var path := "res://assets/kenney/audio/%s.ogg" % f
			if ResourceLoader.exists(path):
				arr.append(load(path))
		if not arr.is_empty():
			sounds[n] = arr
	for n in OGA_SETS:
		var arr: Array = []
		for i in OGA_SETS[n][1]:
			var path := "res://assets/oga/audio/%s%02d.ogg" % [OGA_SETS[n][0], i]
			if ResourceLoader.exists(path):
				arr.append(load(path))
		if not arr.is_empty():
			sounds[n] = arr


func _stream(n: String) -> AudioStream:
	var v = sounds[n]
	if v is Array:
		return v.pick_random()
	return v


func play3d(n: String, pos: Vector3, db := 0.0, pitch_rand := 0.08, pitch := 1.0) -> void:
	if not sounds.has(n):
		return
	var p: AudioStreamPlayer3D = _pool[_pool_i]
	_pool_i = (_pool_i + 1) % _pool.size()
	p.stream = _stream(n)
	p.volume_db = db
	p.pitch_scale = pitch * (1.0 + randf_range(-pitch_rand, pitch_rand))
	if p.is_inside_tree():
		p.global_position = pos
	p.play()


func play2d(n: String, db := 0.0) -> void:
	if not sounds.has(n):
		return
	var p: AudioStreamPlayer = _ui[_ui_i]
	_ui_i = (_ui_i + 1) % _ui.size()
	p.stream = _stream(n)
	p.volume_db = db
	p.play()


## Looping positional sound attached to a node; free the returned player to stop.
func start_loop(n: String, parent: Node3D, db := 0.0) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.stream = _stream(n) if sounds.has(n) else null
	p.volume_db = db
	p.unit_size = 8.0
	p.max_distance = 80.0
	parent.add_child(p)
	p.play()
	return p


# ====================================================================== synthesis

var _rng := RandomNumberGenerator.new()

func _wav(samples: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(samples.size() * 2)
	for i in samples.size():
		data.encode_s16(i * 2, int(clamp(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = samples.size()
	return w


func _buf(sec: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(sec * RATE))
	return b


## Filtered noise burst with exponential decay: gunshots, impacts, explosions.
func _shot(sec: float, decay: float, lp: float, body_hz: float, body_amt: float, gain := 1.0) -> PackedFloat32Array:
	var b := _buf(sec)
	var y := 0.0
	var a: float = clamp(lp / RATE * 6.28, 0.0, 1.0)
	for i in b.size():
		var t := float(i) / RATE
		var env := exp(-t * decay)
		y += a * (_rng.randf_range(-1, 1) - y)
		var body := sin(TAU * body_hz * t * (1.0 - t * 2.0)) * exp(-t * decay * 1.5) * body_amt
		b[i] = (y * 2.2 + body) * env * gain
	return b


func _tone(sec: float, f0: float, f1: float, wave: String, attack: float, decay: float, vib := 0.0, gain := 0.6) -> PackedFloat32Array:
	var b := _buf(sec)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var k := t / sec
		var f: float = lerp(f0, f1, k) * (1.0 + sin(t * 30.0) * vib)
		ph += f / RATE
		var x := 0.0
		match wave:
			"sin": x = sin(ph * TAU)
			"saw": x = fmod(ph, 1.0) * 2.0 - 1.0
			"sqr": x = 1.0 if fmod(ph, 1.0) < 0.5 else -1.0
			"tri": x = abs(fmod(ph, 1.0) * 4.0 - 2.0) - 1.0
		var env: float = min(1.0, t / max(attack, 0.001)) * exp(-max(0.0, t - attack) * decay)
		b[i] = x * env * gain
	return b


## Growly voice: saw through a crude formant (two resonant one-pole filters).
func _voice(sec: float, f0: float, f1: float, rough: float, formant: float, gain := 0.5, decay := 1.5) -> PackedFloat32Array:
	var b := _buf(sec)
	var ph := 0.0
	var lp1 := 0.0
	var lp2 := 0.0
	var a1: float = clamp(formant / RATE * 6.28, 0.0, 1.0)
	var a2: float = clamp(formant * 2.6 / RATE * 6.28, 0.0, 1.0)
	for i in b.size():
		var t := float(i) / RATE
		var k := t / sec
		var f: float = lerp(f0, f1, k) * (1.0 + _rng.randf_range(-rough, rough))
		ph += f / RATE
		var x := fmod(ph, 1.0) * 2.0 - 1.0 + _rng.randf_range(-1, 1) * rough * 2.0
		lp1 += a1 * (x - lp1)
		lp2 += a2 * (x - lp2)
		var env: float = min(1.0, t / 0.05) * min(1.0, (sec - t) / 0.08) * exp(-t * decay * 0.3)
		b[i] = (lp1 * 1.6 + (lp2 - lp1) * 0.6) * env * gain
	return b


func _mix(a: PackedFloat32Array, b: PackedFloat32Array, offset_s := 0.0, gain := 1.0) -> PackedFloat32Array:
	var off := int(offset_s * RATE)
	var out := a.duplicate()
	if out.size() < off + b.size():
		out.resize(off + b.size())
	for i in b.size():
		out[off + i] += b[i] * gain
	return out


func _build() -> void:
	_rng.seed = 1234
	# Guns
	sounds["shot_pistol"] = _wav(_shot(0.35, 18.0, 5000, 140, 0.5, 0.9))
	sounds["shot_magnum"] = _wav(_shot(0.6, 9.0, 3500, 90, 0.9, 1.0))
	sounds["shot_smg"] = _wav(_shot(0.22, 26.0, 6000, 160, 0.4, 0.75))
	sounds["shot_rifle"] = _wav(_shot(0.3, 20.0, 4500, 120, 0.6, 0.9))
	sounds["shot_shotgun"] = _wav(_shot(0.7, 8.0, 2500, 70, 1.0, 1.0))
	sounds["shot_sniper"] = _wav(_shot(0.9, 6.0, 4000, 80, 0.9, 1.0))
	sounds["dry_fire"] = _wav(_tone(0.05, 2400, 1800, "sqr", 0.001, 80.0, 0.0, 0.3))
	var rl := _mix(_tone(0.06, 900, 700, "sqr", 0.001, 60.0, 0.0, 0.3), _tone(0.08, 1300, 1000, "sqr", 0.001, 50.0, 0.0, 0.3), 0.25)
	sounds["reload"] = _wav(rl)
	sounds["shell"] = _wav(_tone(0.07, 700, 500, "sqr", 0.001, 50.0, 0.0, 0.25))
	sounds["step"] = _wav(_shot(0.09, 45.0, 700, 60, 0.6, 0.45))
	sounds["swing"] = _wav(_shot(0.25, 10.0, 900, 0, 0.0, 0.5))
	# Melee: whooshes are band-passed noise sweeps; impacts layer a wet
	# slap, a low thump and (for bone) a short crack.
	sounds["whoosh"] = _wav(_whoosh(0.28, 700.0, 2600.0, 0.55))
	sounds["whoosh_heavy"] = _wav(_whoosh(0.42, 350.0, 1500.0, 0.75))
	sounds["slash"] = _wav(_mix(_mix(_shot(0.22, 16.0, 2200, 0, 0.0, 0.7), _shot(0.3, 12.0, 300, 70, 1.0, 0.7)), _squelch(0.25), 0.02))
	sounds["chop"] = _wav(_mix(_shot(0.18, 22.0, 1800, 0, 0.0, 0.6), _shot(0.25, 14.0, 250, 90, 1.2, 0.8)))
	sounds["bone"] = _wav(_mix(_shot(0.06, 60.0, 6000, 0, 0.0, 0.5), _shot(0.1, 35.0, 900, 160, 0.8, 0.5), 0.01))
	sounds["clank"] = _wav(_mix(_tone(0.6, 1250, 1210, "tri", 0.001, 7.0, 0.002, 0.35), _tone(0.5, 2730, 2700, "sin", 0.001, 9.0, 0.0, 0.2)))
	sounds["block"] = _wav(_mix(_tone(0.35, 980, 950, "tri", 0.001, 12.0, 0.0, 0.35), _shot(0.12, 30.0, 3000, 0, 0.0, 0.5)))
	sounds["melee_hit"] = _wav(_shot(0.2, 25.0, 600, 60, 1.0, 0.9))
	sounds["claw"] = _wav(_shot(0.18, 22.0, 1500, 90, 0.6, 0.7))
	sounds["impact"] = _wav(_shot(0.08, 50.0, 3000, 0, 0.0, 0.4))
	sounds["explosion"] = _wav(_shot(2.0, 2.2, 600, 45, 1.0, 1.0))
	sounds["glass"] = _wav(_mix(_shot(0.4, 10.0, 8000, 0, 0.0, 0.6), _tone(0.3, 3200, 2800, "sin", 0.001, 12.0, 0.02, 0.2)))
	sounds["beep"] = _wav(_tone(0.08, 1800, 1800, "sqr", 0.002, 20.0, 0.0, 0.35))
	sounds["pickup"] = _wav(_tone(0.12, 500, 900, "tri", 0.005, 20.0, 0.0, 0.4))
	sounds["heal"] = _wav(_shot(0.6, 4.0, 2500, 0, 0.0, 0.35))
	sounds["pills"] = _wav(_mix(_tone(0.05, 1200, 1100, "sqr", 0.001, 40.0, 0.0, 0.2), _tone(0.05, 1300, 1100, "sqr", 0.001, 40.0, 0.0, 0.2), 0.12))
	sounds["door"] = _wav(_mix(_tone(0.5, 180, 120, "saw", 0.02, 4.0, 0.03, 0.25), _shot(0.3, 12.0, 400, 50, 1.0, 0.6), 0.35))
	# Survivor voices (wordless grunts; subtitles carry the lines)
	sounds["pain"] = _wav(_voice(0.25, 220, 160, 0.03, 700, 0.5))
	sounds["incap"] = _wav(_voice(0.7, 240, 120, 0.04, 800, 0.6))
	sounds["death"] = _wav(_voice(1.0, 200, 70, 0.05, 600, 0.6))
	# Common infected
	sounds["groan"] = _wav(_voice(1.1, 95, 80, 0.06, 450, 0.4))
	sounds["zombie_chase"] = _wav(_voice(0.7, 150, 120, 0.1, 900, 0.45))
	sounds["zombie_alert"] = _wav(_voice(0.8, 160, 260, 0.12, 1100, 0.55))
	sounds["zombie_die"] = _wav(_voice(0.6, 130, 60, 0.08, 500, 0.45))
	var horde := _buf(4.0)
	for v in 10:
		horde = _mix(horde, _voice(randf_range(1.5, 2.8), randf_range(110, 190), randf_range(90, 240), 0.12, 900, 0.18), randf_range(0.0, 1.2))
	sounds["horde"] = _wav(horde)
	# Specials: each has a recognizable audio tell, like the originals.
	sounds["hunter_growl"] = _wav(_voice(0.9, 90, 85, 0.15, 1400, 0.35))
	sounds["hunter_screech"] = _wav(_voice(0.7, 420, 900, 0.08, 2600, 0.6))
	sounds["smoker_cough"] = _wav(_mix(_shot(0.25, 12.0, 1200, 0, 0.0, 0.5), _shot(0.3, 10.0, 1100, 0, 0.0, 0.5), 0.35))
	sounds["smoker_tongue"] = _wav(_tone(0.5, 300, 1200, "saw", 0.01, 3.0, 0.1, 0.35))
	sounds["boomer_gurgle"] = _wav(_voice(1.3, 60, 70, 0.2, 300, 0.5))
	sounds["boomer_vomit"] = _wav(_mix(_voice(1.2, 80, 50, 0.25, 500, 0.5), _shot(1.2, 2.5, 900, 0, 0.0, 0.5)))
	sounds["boomer_explode"] = _wav(_mix(_shot(1.0, 4.0, 700, 40, 1.0, 1.0), _shot(0.8, 4.0, 2500, 0, 0.0, 0.5), 0.05))
	sounds["charger_roar"] = _wav(_voice(1.2, 110, 180, 0.12, 700, 0.6))
	sounds["spitter_hiss"] = _wav(_mix(_shot(0.8, 3.0, 5000, 0, 0.0, 0.3), _voice(0.6, 300, 260, 0.1, 1800, 0.25)))
	sounds["spit"] = _wav(_shot(0.3, 10.0, 2000, 120, 0.5, 0.6))
	sounds["tank_roar"] = _wav(_voice(1.8, 70, 55, 0.12, 380, 0.8, 0.5))
	sounds["tank_punch"] = _wav(_shot(0.5, 8.0, 400, 50, 1.0, 1.0))
	sounds["witch_scream"] = _wav(_voice(1.4, 700, 1300, 0.06, 3000, 0.7, 0.4))
	# Witch crying: sobbing breaths, looped.
	var cry := _buf(4.0)
	var t0 := 0.0
	while t0 < 3.4:
		var d := randf_range(0.35, 0.7)
		cry = _mix(cry, _voice(d, randf_range(380, 460), randf_range(300, 360), 0.03, 1700, 0.35, 3.0), t0)
		t0 += d + randf_range(0.15, 0.4)
	sounds["witch_cry"] = _wav(cry, true)
	# Loops
	var fire := _buf(2.0)
	var y := 0.0
	for i in fire.size():
		y += 0.08 * (_rng.randf_range(-1, 1) - y)
		var crackle := 0.0
		if _rng.randf() < 0.002:
			crackle = _rng.randf_range(-0.8, 0.8)
		fire[i] = y * 1.5 + crackle
	sounds["fire"] = _wav(fire, true)
	var alarm := _buf(1.0)
	for i in alarm.size():
		var t := float(i) / RATE
		var f := 700.0 if fmod(t, 0.5) < 0.25 else 900.0
		alarm[i] = (1.0 if fmod(t * f, 1.0) < 0.5 else -1.0) * 0.25
	sounds["car_alarm"] = _wav(alarm, true)
	var bell := _buf(2.0)
	for i in bell.size():
		var t := float(i) / RATE
		var on := fmod(t, 1.0) < 0.6
		bell[i] = (sin(TAU * 520.0 * t) * 0.5 + (1.0 if fmod(t * 1040.0, 1.0) < 0.5 else -1.0) * 0.15) * (0.6 if on else 0.0)
	sounds["alarm"] = _wav(bell, true)
	sounds["music_ambient"] = _wav(_ambient_drone(16.0), true)
	sounds["music_tank"] = _wav(_tank_drums(4.0), true)
	sounds["horde_sting"] = _wav(_brass_sting())
	sounds["radio"] = _wav(_mix(_shot(1.5, 1.0, 3000, 0, 0.0, 0.25), _tone(0.3, 1000, 1000, "sin", 0.01, 2.0, 0.0, 0.2), 1.2))
	var heli := _buf(2.0)
	for i in heli.size():
		var t := float(i) / RATE
		heli[i] = _rng.randf_range(-1, 1) * (0.25 + 0.25 * sin(TAU * 11.0 * t)) * 0.6
	sounds["helicopter"] = _wav(heli, true)
	# Rain: band-limited hiss with a slow swell and scattered droplet ticks.
	var rain := _buf(4.0)
	var r1 := 0.0
	var r2 := 0.0
	for i in rain.size():
		var t := float(i) / RATE
		var x := _rng.randf_range(-1, 1)
		r1 += 0.35 * (x - r1)
		r2 += 0.05 * (r1 - r2)
		var swell := 0.8 + 0.2 * sin(TAU * t / 4.0)
		var tick := 0.0
		if _rng.randf() < 0.0015:
			tick = _rng.randf_range(-0.5, 0.5)
		rain[i] = ((r1 - r2) * 0.9 * swell + tick) * 0.5
	# Crossfade the ends so the loop is seamless.
	var xf := int(0.3 * RATE)
	for i in xf:
		var k := float(i) / xf
		rain[i] = rain[i] * k + rain[rain.size() - xf + i] * (1.0 - k)
	sounds["rain"] = _wav(rain.slice(0, rain.size() - xf), true)
	# Thunder: a crack, then a long low rumble.
	var th := _buf(4.5)
	var l1 := 0.0
	var l2 := 0.0
	for i in th.size():
		var t := float(i) / RATE
		var x := _rng.randf_range(-1, 1)
		l1 += 0.02 * (x - l1)
		l2 += 0.004 * (x - l2)
		var rumble := l2 * 14.0 * (1.0 - exp(-t * 6.0)) * exp(-t * 0.8) * (0.7 + 0.3 * sin(TAU * 1.7 * t))
		var crack := l1 * 3.0 * exp(-t * 9.0)
		th[i] = clampf(rumble + crack, -1.0, 1.0) * 0.9
	sounds["thunder"] = _wav(th)


func _whoosh(sec: float, f0: float, f1: float, gain: float) -> PackedFloat32Array:
	var b := _buf(sec)
	var lp := 0.0
	var lp2 := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var k := t / sec
		var f: float = lerp(f0, f1, sin(k * PI))
		var a: float = clamp(f / RATE * 6.28, 0.0, 1.0)
		var x := _rng.randf_range(-1, 1)
		lp += a * (x - lp)
		lp2 += a * 0.5 * (lp - lp2)
		var env := sin(k * PI) * sin(k * PI)
		b[i] = (lp - lp2) * 3.0 * env * gain
	return b


func _squelch(sec: float) -> PackedFloat32Array:
	var b := _buf(sec)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var f := 180.0 + 900.0 * exp(-t * 18.0) + _rng.randf_range(-40, 40)
		ph += f / RATE
		b[i] = sin(ph * TAU) * exp(-t * 14.0) * 0.4 * (0.6 + 0.4 * _rng.randf())
	return b


func _ambient_drone(sec: float) -> PackedFloat32Array:
	var b := _buf(sec)
	var notes := [55.0, 65.4, 49.0, 58.3]
	for i in b.size():
		var t := float(i) / RATE
		var seg := int(t / (sec / 4.0)) % 4
		var f: float = notes[seg]
		var x := sin(TAU * f * t) * 0.25 + sin(TAU * f * 1.502 * t) * 0.12 + sin(TAU * f * 2.003 * t) * 0.06
		var lfo := 0.6 + 0.4 * sin(TAU * t / sec * 2.0)
		b[i] = x * lfo * 0.7
	# Smooth segment edges
	var fade := int(0.4 * RATE)
	for s in 4:
		var c := int(s * sec / 4.0 * RATE)
		for j in range(-fade, fade):
			var k := c + j
			if k >= 0 and k < b.size():
				b[k] *= abs(float(j)) / fade
	return b


func _tank_drums(sec: float) -> PackedFloat32Array:
	var b := _buf(sec)
	var beat := sec / 8.0
	var pattern := [1, 0, 1, 1, 0, 1, 1, 0]
	for i in 8:
		if pattern[i]:
			b = _mix(b, _shot(0.4, 9.0, 300, 55, 1.2, 0.9), i * beat)
		if i % 4 == 2:
			b = _mix(b, _shot(0.25, 14.0, 4000, 180, 0.4, 0.5), i * beat)
	var bass := _tone(sec, 41.2, 41.2, "saw", 0.05, 0.0, 0.0, 0.18)
	var y := 0.0
	for i in bass.size():
		y += 0.02 * (bass[i] - y)
		b[i] += y * 2.0
	return b.slice(0, int(sec * RATE))


func _brass_sting() -> PackedFloat32Array:
	var b := _buf(2.5)
	for f in [146.8, 174.6, 220.0, 293.7]:
		b = _mix(b, _tone(2.4, f, f * 0.97, "saw", 0.04, 1.6, 0.004, 0.12))
	var y := 0.0
	for i in b.size():
		y += 0.15 * (b[i] - y)
		b[i] = y * 1.5
	return b
