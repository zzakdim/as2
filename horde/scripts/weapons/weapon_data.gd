class_name WeaponData
## Weapon definitions. Numbers follow L4D2's published campaign stats where
## they exist (damage per bullet, fire interval, clip, reserve).

const DEFS := {
	"pistol": {
		"name": "Pistol", "slot": 1, "tier": 0, "damage": 36.0, "pellets": 1, "rate": 0.175,
		"auto": false, "mag": 15, "reserve": -1, "spread": 1.2, "reload": 1.6, "pen": 1,
		"range": 80.0, "sound": "shot_pistol", "noise": 25.0, "kick": 0.012,
	},
	"dual_pistols": {
		"name": "Dual Pistols", "slot": 1, "tier": 0, "damage": 36.0, "pellets": 1, "rate": 0.1,
		"auto": false, "mag": 30, "reserve": -1, "spread": 1.8, "reload": 2.2, "pen": 1,
		"range": 80.0, "sound": "shot_pistol", "noise": 25.0, "kick": 0.012,
	},
	"magnum": {
		"name": "Magnum", "slot": 1, "tier": 0, "damage": 80.0, "pellets": 1, "rate": 0.3,
		"auto": false, "mag": 8, "reserve": -1, "spread": 1.0, "reload": 1.9, "pen": 3,
		"range": 90.0, "sound": "shot_magnum", "noise": 30.0, "kick": 0.035,
	},
	"machete": {
		"name": "Machete", "slot": 1, "tier": 0, "melee": true, "moveset": "machete", "damage": 200.0, "rate": 0.55,
		"range": 2.3, "arc": 70.0, "sound": "swing", "noise": 6.0, "kick": 0.0,
	},
	"fire_axe": {
		"name": "Fire Axe", "slot": 1, "tier": 0, "melee": true, "moveset": "fire_axe", "damage": 190.0, "rate": 0.5,
		"range": 2.2, "arc": 60.0, "sound": "swing", "noise": 6.0, "kick": 0.0,
	},
	"sledgehammer": {
		"name": "Sledgehammer", "slot": 1, "tier": 0, "melee": true, "moveset": "sledgehammer", "damage": 160.0, "rate": 0.7,
		"range": 2.4, "arc": 70.0, "sound": "swing", "noise": 8.0, "kick": 0.0,
	},
	"greatsword": {
		"name": "Greatsword", "slot": 1, "tier": 0, "melee": true, "moveset": "greatsword", "damage": 240.0, "rate": 0.5,
		"range": 2.6, "arc": 80.0, "sound": "swing", "noise": 8.0, "kick": 0.0,
	},
	"smg": {
		"name": "SMG", "slot": 0, "tier": 1, "damage": 20.0, "pellets": 1, "rate": 0.065,
		"auto": true, "mag": 50, "reserve": 650, "spread": 2.4, "reload": 2.2, "pen": 1,
		"range": 60.0, "sound": "shot_smg", "noise": 25.0, "kick": 0.006,
	},
	"pump_shotgun": {
		"name": "Pump Shotgun", "slot": 0, "tier": 1, "damage": 25.0, "pellets": 10, "rate": 0.9,
		"auto": false, "mag": 8, "reserve": 56, "spread": 5.5, "reload": 0.45, "shell_reload": true,
		"pen": 1, "range": 30.0, "sound": "shot_shotgun", "noise": 30.0, "kick": 0.05,
	},
	"assault_rifle": {
		"name": "Assault Rifle", "slot": 0, "tier": 2, "damage": 33.0, "pellets": 1, "rate": 0.0875,
		"auto": true, "mag": 50, "reserve": 360, "spread": 1.5, "reload": 2.3, "pen": 2,
		"range": 100.0, "sound": "shot_rifle", "noise": 30.0, "kick": 0.01,
	},
	"auto_shotgun": {
		"name": "Auto Shotgun", "slot": 0, "tier": 2, "damage": 23.0, "pellets": 11, "rate": 0.3,
		"auto": true, "mag": 10, "reserve": 90, "spread": 6.0, "reload": 0.4, "shell_reload": true,
		"pen": 1, "range": 30.0, "sound": "shot_shotgun", "noise": 30.0, "kick": 0.04,
	},
	"hunting_rifle": {
		"name": "Hunting Rifle", "slot": 0, "tier": 2, "damage": 90.0, "pellets": 1, "rate": 0.25,
		"auto": false, "mag": 15, "reserve": 150, "spread": 0.25, "reload": 3.0, "pen": 4,
		"range": 150.0, "sound": "shot_sniper", "noise": 35.0, "kick": 0.03,
	},
}

const THROWABLES := {
	"pipe_bomb": {"name": "Pipe Bomb", "color": Color(0.5, 0.5, 0.45)},
	"molotov": {"name": "Molotov", "color": Color(0.6, 0.35, 0.1)},
	"bile_jar": {"name": "Bile Jar", "color": Color(0.35, 0.6, 0.2)},
}


static func get_def(id: String) -> Dictionary:
	return DEFS.get(id, DEFS["pistol"])


static func display_name(id: String) -> String:
	if DEFS.has(id):
		return DEFS[id]["name"]
	if THROWABLES.has(id):
		return THROWABLES[id]["name"]
	match id:
		"medkit": return "First Aid Kit"
		"pills": return "Pain Pills"
		"ammo": return "Ammo"
	return id.capitalize()


static func new_state(id: String) -> Dictionary:
	var d := get_def(id)
	return {"id": id, "mag": d.get("mag", 0), "reserve": d.get("reserve", 0)}


## Placeholder gun model built from boxes. Barrel points along -Z.
# Real gun meshes (Quaternius Ultimate Gun Pack, CC0): OBJ with the origin on
# the pistol grip, muzzle along +X. [file, overall length in m, support-hand
# point in our model space (muzzle along -Z)].
const GUN_MODELS := {
	"pistol": ["Pistol_1", 0.2, Vector3(-0.02, -0.05, 0.0)],
	"dual_pistols": ["Pistol_1", 0.2, Vector3(-0.02, -0.05, 0.0)],
	"magnum": ["Revolver_1", 0.3, Vector3(-0.02, -0.05, 0.0)],
	"smg": ["SubmachineGun_2", 0.52, Vector3(0, -0.07, -0.09)],
	"pump_shotgun": ["Shotgun_1", 1.0, Vector3(0, -0.03, -0.42)],
	"auto_shotgun": ["Shotgun_3", 1.0, Vector3(0, -0.03, -0.38)],
	"assault_rifle": ["AssaultRifle2_1", 0.84, Vector3(0, -0.02, -0.24)],
	"hunting_rifle": ["SniperRifle_1", 1.12, Vector3(0, -0.03, -0.3)],
}
static var _gun_meshes := {}


## Support-hand grip for first-person arms (model space), or null.
static func fore_grip(id: String):
	if GUN_MODELS.has(id) and ResourceLoader.exists("res://assets/quaternius/guns/%s.obj" % GUN_MODELS[id][0]):
		return GUN_MODELS[id][2]
	return null


static func _real_gun(id: String) -> Node3D:
	if not GUN_MODELS.has(id):
		return null
	var path := "res://assets/quaternius/guns/%s.obj" % GUN_MODELS[id][0]
	if not ResourceLoader.exists(path):
		return null
	if not _gun_meshes.has(path):
		_gun_meshes[path] = load(path)
	var mesh: Mesh = _gun_meshes[path]
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var sc: float = GUN_MODELS[id][1] / maxf(mesh.get_aabb().size.x, 0.001)
	mi.transform = Transform3D(Basis(Vector3.UP, PI / 2).scaled(Vector3.ONE * sc), Vector3.ZERO)
	return mi


static func build_model(id: String, view := false) -> Node3D:
	var root := Node3D.new()
	var real := _real_gun(id)
	if real:
		root.add_child(real)
		if view:
			real.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		return root
	var dark := Mats.color(Color(0.12, 0.12, 0.13), 0.4, 0.6)
	var wood := Mats.color(Color(0.35, 0.2, 0.1), 0.7)
	var steel := Mats.color(Color(0.5, 0.5, 0.52), 0.35, 0.8)
	match id:
		"pistol", "dual_pistols", "magnum":
			var l := 0.24 if id == "magnum" else 0.18
			Mats.add_mesh(root, Mats.box(Vector3(0.04, 0.05, l)), steel if id == "magnum" else dark, Vector3(0, 0.02, -l * 0.5))
			Mats.add_mesh(root, Mats.box(Vector3(0.035, 0.1, 0.05)), dark, Vector3(0, -0.04, 0.0), Vector3(-0.25, 0, 0))
		"machete":
			Mats.add_mesh(root, Mats.box(Vector3(0.05, 0.03, 0.14)), wood, Vector3(0, 0, -0.07))
			var mb := Mats.add_mesh(root, Mats.box(Vector3(0.07, 0.012, 0.5)), steel.duplicate(), Vector3(0.01, 0, -0.4))
			mb.name = "Blade"
		"fire_axe":
			var handle := Mats.add_mesh(root, Mats.box(Vector3(0.04, 0.035, 0.95)), wood, Vector3(0, 0, -0.47))
			handle.name = "Handle"
			var red := Mats.color(Color(0.62, 0.08, 0.06), 0.4, 0.4)
			var ab := Mats.add_mesh(root, Mats.box(Vector3(0.2, 0.025, 0.14)), steel.duplicate(), Vector3(0.1, 0, -0.9))
			ab.name = "Blade"
			Mats.add_mesh(root, Mats.box(Vector3(0.08, 0.05, 0.12)), red, Vector3(0.0, 0, -0.9))
			Mats.add_mesh(root, Mats.box(Vector3(0.12, 0.04, 0.05)), red, Vector3(-0.08, 0, -0.9))
		"sledgehammer":
			Mats.add_mesh(root, Mats.box(Vector3(0.045, 0.045, 1.05)), wood, Vector3(0, 0, -0.52))
			var hb := Mats.add_mesh(root, Mats.box(Vector3(0.3, 0.14, 0.15)), Mats.color(Color(0.35, 0.36, 0.38), 0.45, 0.7).duplicate(), Vector3(0, 0, -1.02))
			hb.name = "Blade"
		"greatsword":
			var leather := Mats.color(Color(0.16, 0.1, 0.07), 0.8)
			var brass := Mats.color(Color(0.55, 0.42, 0.2), 0.35, 0.8)
			var blade_mat := Mats.color(Color(0.62, 0.63, 0.66), 0.32, 0.55).duplicate()
			Mats.add_mesh(root, Mats.sphere(0.035, 8), brass, Vector3(0, 0, 0.02))
			Mats.add_mesh(root, Mats.cylinder(0.022, 0.32, 8), leather, Vector3(0, 0, -0.17), Vector3(PI / 2, 0, 0))
			Mats.add_mesh(root, Mats.box(Vector3(0.36, 0.045, 0.06)), brass, Vector3(0, 0, -0.35))
			Mats.add_mesh(root, Mats.box(Vector3(0.1, 0.06, 0.08)), brass, Vector3(0, 0, -0.39))
			var b := Mats.add_mesh(root, Mats.box(Vector3(0.078, 0.014, 1.08)), blade_mat, Vector3(0, 0, -0.93))
			b.name = "Blade"
			var tip := Mats.add_mesh(root, Mats.box(Vector3(0.055, 0.014, 0.055)), blade_mat, Vector3(0, 0, -1.47), Vector3(0, PI / 4, 0))
			tip.name = "Tip"
			Mats.add_mesh(root, Mats.box(Vector3(0.016, 0.017, 0.86)), Mats.color(Color(0.3, 0.3, 0.32), 0.3, 0.9), Vector3(0, 0, -0.86))
		"smg":
			Mats.add_mesh(root, Mats.box(Vector3(0.06, 0.08, 0.36)), dark, Vector3(0, 0.02, -0.15))
			Mats.add_mesh(root, Mats.box(Vector3(0.04, 0.16, 0.04)), dark, Vector3(0, -0.08, -0.12))
			Mats.add_mesh(root, Mats.box(Vector3(0.035, 0.1, 0.05)), dark, Vector3(0, -0.05, 0.0), Vector3(-0.3, 0, 0))
		"pump_shotgun", "auto_shotgun":
			Mats.add_mesh(root, Mats.box(Vector3(0.05, 0.06, 0.7)), dark, Vector3(0, 0.03, -0.35))
			Mats.add_mesh(root, Mats.box(Vector3(0.06, 0.06, 0.25)), wood if id == "pump_shotgun" else dark, Vector3(0, -0.02, -0.4))
			Mats.add_mesh(root, Mats.box(Vector3(0.05, 0.1, 0.3)), wood if id == "pump_shotgun" else dark, Vector3(0, -0.03, 0.12))
		"assault_rifle":
			Mats.add_mesh(root, Mats.box(Vector3(0.06, 0.09, 0.62)), dark, Vector3(0, 0.02, -0.3))
			Mats.add_mesh(root, Mats.box(Vector3(0.045, 0.18, 0.06)), dark, Vector3(0, -0.1, -0.25), Vector3(0.2, 0, 0))
			Mats.add_mesh(root, Mats.box(Vector3(0.05, 0.1, 0.25)), dark, Vector3(0, -0.02, 0.12))
		"hunting_rifle":
			Mats.add_mesh(root, Mats.box(Vector3(0.05, 0.07, 0.85)), wood, Vector3(0, 0.0, -0.3))
			Mats.add_mesh(root, Mats.cylinder(0.025, 0.25), dark, Vector3(0, 0.08, -0.25), Vector3(PI / 2, 0, 0))
		"medkit":
			Mats.add_mesh(root, Mats.box(Vector3(0.3, 0.22, 0.12)), Mats.color(Color(0.75, 0.1, 0.1)))
			Mats.add_mesh(root, Mats.box(Vector3(0.12, 0.03, 0.125)), Mats.color(Color(0.95, 0.95, 0.95)), Vector3(0, 0, 0))
			Mats.add_mesh(root, Mats.box(Vector3(0.03, 0.12, 0.125)), Mats.color(Color(0.95, 0.95, 0.95)), Vector3(0, 0, 0))
		"pills":
			Mats.add_mesh(root, Mats.cylinder(0.035, 0.1), Mats.color(Color(0.9, 0.6, 0.1), 0.3))
			Mats.add_mesh(root, Mats.cylinder(0.037, 0.03), Mats.color(Color(0.95, 0.95, 0.95)), Vector3(0, 0.06, 0))
		"pipe_bomb":
			Mats.add_mesh(root, Mats.cylinder(0.035, 0.2), steel, Vector3.ZERO, Vector3(PI / 2, 0, 0))
			Mats.add_mesh(root, Mats.sphere(0.02), Mats.emissive(Color(1, 0.1, 0.1), 3.0), Vector3(0, 0.04, 0))
		"molotov":
			Mats.add_mesh(root, Mats.cylinder(0.045, 0.2), Mats.color(Color(0.3, 0.5, 0.2, 1), 0.2), Vector3.ZERO)
			Mats.add_mesh(root, Mats.box(Vector3(0.03, 0.08, 0.03)), Mats.emissive(Color(1, 0.6, 0.1), 2.0), Vector3(0, 0.13, 0))
		"bile_jar":
			Mats.add_mesh(root, Mats.sphere(0.07), Mats.color(Color(0.4, 0.6, 0.15), 0.2))
		"ammo":
			Mats.add_mesh(root, Mats.box(Vector3(0.6, 0.3, 0.4)), Mats.color(Color(0.25, 0.3, 0.18)))
			Mats.add_mesh(root, Mats.box(Vector3(0.5, 0.15, 0.3)), Mats.color(Color(0.7, 0.55, 0.2), 0.4, 0.7), Vector3(0, 0.2, 0))
		_:
			Mats.add_mesh(root, Mats.box(Vector3(0.1, 0.1, 0.3)), dark)
	if view:
		for c in root.get_children():
			if c is MeshInstance3D:
				c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return root
