"""
Blender headless script: Convert Fusion 360 OBJ to GLB with PBR materials.
Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert-obj-to-glb.py
"""
import bpy
import os
import sys

# Paths
OBJ_PATH = "/Users/daniilsolopov/Downloads/26-12 -- 70mm MOD.obj"
OUTPUT_DIR = "/Users/daniilsolopov/Dev/onemo-dev/onemo-next/public/assets/shapes"
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "effect-70mm.glb")
MATERIAL_DIR = "/Users/daniilsolopov/Dev/onemo-dev/onemo-next/public/assets/materials/ultrasuede"

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import OBJ
print(f"Importing: {OBJ_PATH}")
bpy.ops.wm.obj_import(filepath=OBJ_PATH)

# Get imported objects
imported = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
print(f"Imported {len(imported)} objects")

for obj in imported:
    print(f"  Object: {obj.name}, vertices: {len(obj.data.vertices)}, faces: {len(obj.data.polygons)}")

    # Scale from cm to meters (Fusion exports in cm, Three.js expects meters)
    obj.scale = (0.01, 0.01, 0.01)

    # Apply scale
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    obj.select_set(False)

# Set up materials based on vertex groups / object names
for obj in imported:
    # Clear existing materials
    obj.data.materials.clear()

    # Check mesh name / vertex group names for FACE, BACK, Frame
    mesh_name = obj.name.upper()

    for i, mat_slot in enumerate(obj.material_slots):
        pass  # Clear slots

    # The OBJ has groups: FACE, BACK, Frame
    # After import, these might be separate objects or vertex groups
    # Let's check what we have
    print(f"  Vertex groups: {[vg.name for vg in obj.vertex_groups]}")
    print(f"  Materials: {[mat.name for mat in obj.data.materials]}")

# Since OBJ groups import as vertex groups under one object (or separate objects),
# let's handle both cases

# Check if groups became separate objects
face_obj = None
back_obj = None
frame_obj = None

for obj in imported:
    name = obj.name.upper()
    if 'FACE' in name:
        face_obj = obj
    elif 'BACK' in name:
        back_obj = obj
    elif 'FRAME' in name:
        frame_obj = obj

# If only one object, check vertex groups
if len(imported) == 1:
    obj = imported[0]
    # We'll need to separate by vertex groups
    print("Single object imported — checking vertex groups for separation")
elif face_obj:
    print(f"Separate objects found: FACE={face_obj.name}, BACK={back_obj.name if back_obj else 'none'}, Frame={frame_obj.name if frame_obj else 'none'}")

# Create PBR materials
def create_suede_material(name, color=(0.15, 0.12, 0.10, 1.0)):
    """Create ultra suede PBR material"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create Principled BSDF
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0.0

    # Output
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    # Normal map
    normal_path = os.path.join(MATERIAL_DIR, "normal.jpg")
    if os.path.exists(normal_path):
        normal_tex = nodes.new('ShaderNodeTexImage')
        normal_tex.location = (-600, -200)
        normal_tex.image = bpy.data.images.load(normal_path)
        normal_tex.image.colorspace_settings.name = 'Non-Color'

        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (-300, -200)
        normal_map.inputs['Strength'].default_value = 0.5

        links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

    # Roughness map
    rough_path = os.path.join(MATERIAL_DIR, "roughness.jpg")
    if os.path.exists(rough_path):
        rough_tex = nodes.new('ShaderNodeTexImage')
        rough_tex.location = (-600, 100)
        rough_tex.image = bpy.data.images.load(rough_path)
        rough_tex.image.colorspace_settings.name = 'Non-Color'

        links.new(rough_tex.outputs['Color'], bsdf.inputs['Roughness'])

    return mat

def create_dark_material(name, color=(0.02, 0.02, 0.02, 1.0)):
    """Create simple dark material for back/frame"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    nodes.clear()

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.7
    bsdf.inputs['Metallic'].default_value = 0.0

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat

# Create materials
face_mat = create_suede_material("FACE_ultrasuede", color=(0.6, 0.55, 0.5, 1.0))
back_mat = create_dark_material("BACK_dark", color=(0.02, 0.02, 0.02, 1.0))
frame_mat = create_dark_material("FRAME_dark", color=(0.05, 0.05, 0.05, 1.0))

# Assign materials to objects
if face_obj:
    face_obj.data.materials.clear()
    face_obj.data.materials.append(face_mat)
    face_obj.name = "PRINT_SURFACE_FRONT"
    print(f"Assigned suede material to FACE → renamed to PRINT_SURFACE_FRONT")

if back_obj:
    back_obj.data.materials.clear()
    back_obj.data.materials.append(back_mat)
    print(f"Assigned dark material to BACK")

if frame_obj:
    frame_obj.data.materials.clear()
    frame_obj.data.materials.append(frame_mat)
    print(f"Assigned dark material to Frame")

# Export GLB
os.makedirs(OUTPUT_DIR, exist_ok=True)
print(f"Exporting to: {OUTPUT_GLB}")

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_GLB,
    export_format='GLB',
    export_materials='EXPORT',
    export_texcoords=True,
    export_normals=True,
    export_apply=True,
    export_yup=True,
)

print(f"Done! GLB saved to {OUTPUT_GLB}")
file_size = os.path.getsize(OUTPUT_GLB)
print(f"File size: {file_size / 1024:.1f} KB")
