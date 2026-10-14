class_name Weather
extends Node3D
## Storm for a map: rain streaks that follow the camera, occasional lightning
## (moonlight and sky flash, thunder a moment later), a wet sheen on the
## streets, and the rain loop.

var moon: DirectionalLight3D
var env: Environment
var rain: CPUParticles3D
var rain_sound: AudioStreamPlayer
var base_moon := 0.35
var base_ambient := 0.45
var base_bg := Color()
var flash := 0.0
var next_bolt := 14.0
var thunder_in := -1.0


func setup(moon_light: DirectionalLight3D, environment: Environment) -> void:
	moon = moon_light
	env = environment
	base_moon = moon.light_energy
	base_ambient = env.ambient_light_energy
	base_bg = env.background_color
	next_bolt = randf_range(8.0, 20.0)


func _ready() -> void:
	rain = CPUParticles3D.new()
	rain.amount = 2600
	rain.lifetime = 0.8
	rain.preprocess = 0.8
	rain.local_coords = false
	rain.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	rain.emission_box_extents = Vector3(16, 0.5, 16)
	rain.direction = Vector3(0.12, -1, 0.06)
	rain.spread = 3.0
	rain.initial_velocity_min = 20.0
	rain.initial_velocity_max = 26.0
	rain.gravity = Vector3(0, -9.8, 0)
	rain.particle_flag_align_y = true
	var m := BoxMesh.new()
	m.size = Vector3(0.008, 0.55, 0.008)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(0.7, 0.75, 0.85, 0.28)
	m.material = mat
	rain.mesh = m
	rain.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(rain)
	if Game.sfx:
		rain_sound = AudioStreamPlayer.new()
		rain_sound.stream = Game.sfx.sounds.get("rain")
		rain_sound.volume_db = -9.0
		add_child(rain_sound)
		rain_sound.play()
	# Wet streets: glossy asphalt with puddle-like variation.
	var a := Mats.asphalt()
	a.albedo_color = a.albedo_color.darkened(0.25)
	a.roughness = 1.0
	a.roughness_texture = Mats._noise_tex("puddles", 0.02, 7)
	a.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	a.metallic_specular = 0.8


func _exit_tree() -> void:
	# The asphalt material is shared and cached: dry it again.
	var a := Mats.asphalt()
	a.albedo_color = Color(0.19, 0.19, 0.2)
	a.roughness = 0.95
	a.roughness_texture = null
	a.metallic_specular = 0.5


func _process(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam:
		var f := -cam.global_basis.z
		f.y = 0.0
		rain.global_position = cam.global_position + Vector3(0, 9, 0) + f.normalized() * 6.0
	next_bolt -= delta
	if next_bolt <= 0.0:
		next_bolt = randf_range(14.0, 35.0)
		flash = 1.0
		thunder_in = randf_range(0.4, 2.5)
	if thunder_in > 0.0:
		thunder_in -= delta
		if thunder_in <= 0.0 and Game.sfx:
			Game.sfx.play2d("thunder", -4.0)
	if flash > 0.0:
		flash = maxf(0.0, flash - delta * 2.2)
		# Double-flicker like a real strike.
		var k := flash * (0.6 + 0.4 * sin(flash * 40.0))
		if moon:
			moon.light_energy = base_moon + 3.0 * k
		if env:
			env.ambient_light_energy = base_ambient + 1.2 * k
			env.background_color = base_bg.lerp(Color(0.5, 0.55, 0.7), k * 0.6)
