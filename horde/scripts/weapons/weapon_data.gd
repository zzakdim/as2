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
		"name": "Machete", "slot": 1, "tier": 0, "melee": true, "damage": 200.0, "rate": 0.55,
		"range": 2.3, "arc": 70.0, "sound": "swing", "noise": 6.0, "kick": 0.0,
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
static func build_model(id: String, view := false) -> Node3D:
	var root := Node3D.new()
	var dark := Mats.color(Color(0.12, 0.12, 0.13), 0.4, 0.6)
	var wood := Mats.color(Color(0.35, 0.2, 0.1), 0.7)
	var steel := Mats.color(Color(0.5, 0.5, 0.52), 0.35, 0.8)
	match id:
		"pistol", "dual_pistols", "magnum":
			var l := 0.24 if id == "magnum" else 0.18
			Mats.add_mesh(root, Mats.box(Vector3(0.04, 0.05, l)), steel if id == "magnum" else dark, Vector3(0, 0.02, -l * 0.5))
			Mats.add_mesh(root, Mats.box(Vector3(0.035, 0.1, 0.05)), dark, Vector3(0, -0.04, 0.0), Vector3(-0.25, 0, 0))
		"machete":
			Mats.add_mesh(root, Mats.box(Vector3(0.03, 0.05, 0.14)), wood, Vector3(0, 0, 0.0))
			Mats.add_mesh(root, Mats.box(Vector3(0.012, 0.07, 0.5)), steel, Vector3(0, 0.01, -0.32))
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
