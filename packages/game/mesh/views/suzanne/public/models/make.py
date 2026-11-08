import bpy, math, sys
import os
# writes into views/suzanne/public/models and views/skin/public/models
here = os.path.dirname(os.path.abspath(__file__))
views = os.path.normpath(os.path.join(here, "..", "..", ".."))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, rgba):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = rgba
    return m

# suzanne
reset()
bpy.ops.mesh.primitive_monkey_add(size=2)
monkey = bpy.context.active_object
monkey.modifiers.new("sub", "SUBSURF").levels = 1
bpy.ops.object.shade_smooth()
monkey.data.materials.append(material("monkey", (0.85, 0.55, 0.25, 1)))
bpy.ops.export_scene.gltf(filepath=os.path.join(views, "suzanne", "public", "models", "suzanne.glb"), export_format="GLB", export_apply=True, export_texcoords=False)

# tentacle: tapered cylinder, 6 bone chain, auto weights, wave animation
reset()
import bmesh
mesh = bpy.data.meshes.new("tentacle"); body = bpy.data.objects.new("tentacle", mesh)
bpy.context.collection.objects.link(body)
bm = bmesh.new(); SIDES, RINGS = 16, 30; rings = []
for r in range(RINGS + 1):
    z = r / RINGS * 6; radius = 0.35 * (1 - z / 6 * 0.75)
    rings.append([bm.verts.new((math.cos(a / SIDES * 2 * math.pi) * radius, math.sin(a / SIDES * 2 * math.pi) * radius, z)) for a in range(SIDES)])
for r in range(RINGS):
    for a in range(SIDES):
        b = (a + 1) % SIDES
        bm.faces.new((rings[r][a], rings[r][b], rings[r + 1][b], rings[r + 1][a]))
bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
bm.to_mesh(mesh); bm.free()
bpy.context.view_layer.objects.active = body; body.select_set(True)
bpy.ops.object.shade_smooth()
body.data.materials.append(material("skin", (0.45, 0.3, 0.75, 1)))

bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.active_object
bpy.ops.object.mode_set(mode="EDIT")
bones = rig.data.edit_bones
first = bones[0]; first.name = "b0"; first.head = (0, 0, 0); first.tail = (0, 0, 1)
parent = first
for i in range(1, 6):
    b = bones.new(f"b{i}"); b.head = (0, 0, i); b.tail = (0, 0, i + 1); b.parent = parent; b.use_connect = True
    parent = b
bpy.ops.object.mode_set(mode="OBJECT")

body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 60
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
for frame in range(1, 61, 5):
    scene.frame_set(frame)
    for i, pb in enumerate(rig.pose.bones):
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (math.sin((frame - 1) / 60 * 2 * math.pi - i * 0.6) * 0.35, 0, 0)
        pb.keyframe_insert("rotation_euler", frame=frame)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(views, "skin", "public", "models", "tentacle.glb"), export_format="GLB", export_texcoords=False, export_animations=True)
