class_name Mats
## Cached placeholder materials, meshes and procedural textures.

static var _mats := {}
static var _meshes := {}
static var _tex := {}


static func color(c: Color, roughness := 0.85, metallic := 0.0) -> StandardMaterial3D:
	var key := "c%s_%.2f_%.2f" % [c.to_html(), roughness, metallic]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = roughness
	m.metallic = metallic
	_mats[key] = m
	return m


static func emissive(c: Color, energy := 2.0) -> StandardMaterial3D:
	var key := "e%s_%.2f" % [c.to_html(), energy]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	_mats[key] = m
	return m


static func unshaded(c: Color, transparent := false) -> StandardMaterial3D:
	var key := "u%s_%s" % [c.to_html(), transparent]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if transparent:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[key] = m
	return m


static func box(size: Vector3) -> BoxMesh:
	var key := "b%s" % size
	if _meshes.has(key):
		return _meshes[key]
	var b := BoxMesh.new()
	b.size = size
	_meshes[key] = b
	return b


static func sphere(r: float, segs := 10) -> SphereMesh:
	var key := "s%.3f_%d" % [r, segs]
	if _meshes.has(key):
		return _meshes[key]
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = segs
	s.rings = segs / 2
	_meshes[key] = s
	return s


static func cylinder(r: float, h: float, segs := 10) -> CylinderMesh:
	var key := "cy%.3f_%.3f_%d" % [r, h, segs]
	if _meshes.has(key):
		return _meshes[key]
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = segs
	c.rings = 1
	_meshes[key] = c
	return c


## Adds a MeshInstance3D to `parent` and returns it.
static func add_mesh(parent: Node3D, mesh: Mesh, mat: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi


# ------------------------------------------------------------ textures

static func _noise_tex(key: String, freq: float, seed_v: int, size := 256) -> NoiseTexture2D:
	if _tex.has(key):
		return _tex[key]
	var n := FastNoiseLite.new()
	n.seed = seed_v
	n.frequency = freq
	n.fractal_octaves = 4
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = true
	t.noise = n
	_tex[key] = t
	return t


static func asphalt() -> StandardMaterial3D:
	if _mats.has("asphalt"):
		return _mats["asphalt"]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.19, 0.19, 0.2)
	m.albedo_texture = _noise_tex("asphalt", 0.08, 3)
	m.roughness = 0.95
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.12, 0.12, 0.12)
	_mats["asphalt"] = m
	return m


static func tiles() -> StandardMaterial3D:
	if _mats.has("tiles"):
		return _mats["tiles"]
	var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
	img.fill(Color(0.42, 0.4, 0.36))
	for i in 64:
		img.set_pixel(i, 0, Color(0.2, 0.2, 0.18))
		img.set_pixel(0, i, Color(0.2, 0.2, 0.18))
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.roughness = 0.6
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(1, 1, 1)
	_mats["tiles"] = m
	return m


## Brick-ish building facade with windows (some lit), world-space triplanar.
static func facade() -> StandardMaterial3D:
	if _mats.has("facade"):
		return _mats["facade"]
	var s := 128
	var img := Image.create(s, s, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for y in s:
		for x in s:
			var v := 0.22 + rng.randf() * 0.05
			if y % 16 == 0 or (x + (y / 16) * 8) % 32 == 0:
				v = 0.15
			img.set_pixel(x, y, Color(v * 1.15, v * 0.95, v * 0.85))
	# windows: 4x4 grid per tile
	for wy in 4:
		for wx in 4:
			var lit := rng.randf() < 0.12
			var c := Color(0.9, 0.75, 0.4) if lit else Color(0.05, 0.06, 0.08)
			img.fill_rect(Rect2i(wx * 32 + 8, wy * 32 + 6, 16, 18), c)
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.roughness = 0.9
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.125, 0.125, 0.125)
	m.emission_enabled = true
	m.emission_texture = m.albedo_texture
	m.emission = Color(0.0, 0.0, 0.0)
	m.emission_energy_multiplier = 0.15
	m.emission_operator = BaseMaterial3D.EMISSION_OP_ADD
	_mats["facade"] = m
	return m


static func concrete() -> StandardMaterial3D:
	if _mats.has("concrete"):
		return _mats["concrete"]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.42, 0.42, 0.4)
	m.albedo_texture = _noise_tex("concrete", 0.05, 11)
	m.roughness = 0.95
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.2, 0.2, 0.2)
	_mats["concrete"] = m
	return m


static func saferoom_wall() -> StandardMaterial3D:
	if _mats.has("safewall"):
		return _mats["safewall"]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.36, 0.45, 0.38)
	m.albedo_texture = _noise_tex("safewall", 0.1, 5)
	m.roughness = 0.8
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(0.3, 0.3, 0.3)
	_mats["safewall"] = m
	return m


static func fence() -> StandardMaterial3D:
	if _mats.has("fence"):
		return _mats["fence"]
	var s := 64
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for i in s:
		for w in 2:
			img.set_pixel((i + w) % s, i, Color(0.6, 0.6, 0.62, 1))
			img.set_pixel((s - 1 - i + w) % s, i, Color(0.6, 0.6, 0.62, 1))
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.5
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.metallic = 0.6
	m.roughness = 0.5
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3(1.5, 1.5, 1.5)
	_mats["fence"] = m
	return m


## Soft round splat used by blood decals.
## Screen-blood spray: a dense core, streaks fanning out one way and loose
## droplets, with darker edges where it pools. `v` picks a variant.
static func screen_spray(v: int) -> Texture2D:
	var key := "spray%d" % v
	if _tex.has(key):
		return _tex[key]
	var s := 192
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 1234 + v * 77
	var dens := PackedFloat32Array()
	dens.resize(s * s)
	var c := Vector2(s * 0.3, s * 0.5)
	var stamp := func(p: Vector2, r: float, amt: float):
		var x0 := maxi(0, int(p.x - r - 1))
		var x1 := mini(s - 1, int(p.x + r + 1))
		var y0 := maxi(0, int(p.y - r - 1))
		var y1 := mini(s - 1, int(p.y + r + 1))
		for y in range(y0, y1 + 1):
			for x in range(x0, x1 + 1):
				var d := Vector2(x, y).distance_to(p) / r
				if d < 1.0:
					dens[y * s + x] += amt * (1.0 - d * d)
	# core
	for i in 14:
		stamp.call(c + Vector2(rng.randf_range(-14, 14), rng.randf_range(-14, 14)), rng.randf_range(8, 18), 1.0)
	# streaks: chains of shrinking blobs fanning toward +X
	for k in 9:
		var ang := rng.randf_range(-0.7, 0.7)
		var d := Vector2(cos(ang), sin(ang))
		var p := c
		var r := rng.randf_range(5, 9)
		var length := rng.randf_range(50, 120)
		var t := 0.0
		while t < length and r > 1.2:
			stamp.call(p + d * t, r, 0.9)
			t += r * 0.6
			r *= 0.965
		stamp.call(p + d * (t + rng.randf_range(4, 12)), r * 1.8, 1.0)   # end drop
	# loose droplets
	for i in 40:
		var ang := rng.randf_range(-0.9, 0.9)
		var dist := rng.randf_range(20, 150)
		stamp.call(c + Vector2(cos(ang), sin(ang)) * dist, rng.randf_range(1.2, 4.0), 1.0)
	for y in s:
		for x in s:
			var a: float = clampf(dens[y * s + x] * 1.6, 0.0, 1.0)
			if a <= 0.01:
				continue
			# Thicker = darker; thin edges stay brighter red.
			var col := Color(0.42, 0.02, 0.02).lerp(Color(0.16, 0.005, 0.005), clampf(dens[y * s + x] - 0.6, 0.0, 1.0))
			col.a = a * 0.9
			img.set_pixel(x, y, col)
	var tex := ImageTexture.create_from_image(img)
	_tex[key] = tex
	return tex


static func blood_splat() -> Texture2D:
	if _tex.has("blood"):
		return _tex["blood"]
	var s := 64
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	var blobs := []
	for i in 9:
		blobs.append([Vector2(rng.randf_range(16, 48), rng.randf_range(16, 48)), rng.randf_range(4, 13)])
	for y in s:
		for x in s:
			var a := 0.0
			for b in blobs:
				var d: float = Vector2(x, y).distance_to(b[0])
				a = max(a, clamp(1.0 - d / b[1], 0.0, 1.0))
			img.set_pixel(x, y, Color(0.35, 0.02, 0.02, clamp(a * 2.2, 0.0, 0.9)))
	var t := ImageTexture.create_from_image(img)
	_tex["blood"] = t
	return t
