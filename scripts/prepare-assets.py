"""Prepara os assets da LP Explore a partir da pasta do fornecedor (cores, ambientes e catálogo em PDF).

Uso: python3 scripts/prepare-assets.py
Gera originais redimensionados em src/assets (o Astro produz AVIF/WebP no build).

- cores/        39 texturas (uma por cor), 1:1
- ambientes/    renders 3D da pasta "ambientada" (sem as 2 duplicadas)
- catalogo/     fotos tiradas de dentro do catálogo: capa (montada a partir dos blocos), fotos reais de obra
                (p.22 a 27) e a tecelagem (p.38)
- badges/       selos da p.37, renderizados do vetor do PDF
"""
import io
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "arquivos do fornecedor" / "Explore"
PDF = SRC / "cat_Explore v5.pdf"
OUT = ROOT / "src" / "assets"


def save(img, dest, max_side, quality=86):
    img = img.convert("RGB")
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"{dest.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}")


# Cores: "Frontier-203.jpg" → cores/frontier-203.jpg
for f in sorted((SRC / "cores").glob("*.jpg")):
    save(Image.open(f), OUT / "cores" / f"{f.stem.lower()}.jpg", 1000, 84)

# Ambientes (renders). explore10 (1) = explore10 e explore13 = explore11 (duplicadas). Da vista de cima
# (explore8 a 15) entram 4 tons bem diferentes entre si: azul, grafite, cinza e bege.
ambientes = {
    "explore1": "cafe-journey-102",
    "explore2": "estacoes-frontier-206-adventure-306",
    "explore3": "lobby-odyssey-403-frontier-203",
    "explore4": "diretoria-navigator-506",
    "explore5": "recepcao-frontier-202-adventure-302",
    "explore6": "sala-reuniao",
    "explore7": "open-office-adventure-305",
    "explore8": "vista-azul",
    "explore9": "vista-grafite",
    "explore10": "vista-cinza",
    "explore12": "vista-bege",
    "Cena 25_Belgotex_608 + 609": "lounge-horizon-608-609",
    "Cena 26_Belgotex_607": "lounge-horizon-607",
}
for name, slug in ambientes.items():
    save(Image.open(SRC / "ambientada" / f"{name}.jpg"), OUT / "ambientes" / f"{slug}.jpg", 2400)

# Catálogo
doc = fitz.open(PDF)


def raw(xref):
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha >= 4:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def largest(page_no):
    page = doc[page_no - 1]
    return raw(max(page.get_images(full=True), key=lambda im: im[2] * im[3])[0])


# Capa: a foto vem em 8 blocos; monta de novo sem os textos por cima
page = doc[0]
k = 4.22
cover = Image.new("RGB", (round(page.rect.width * k), round(page.rect.height * k)))
for im in page.get_images(full=True):
    r = page.get_image_rects(im[0])[0]
    tile = raw(im[0]).resize((round(r.width * k), round(r.height * k)), Image.LANCZOS)
    cover.paste(tile, (round(r.x0 * k), round(r.y0 * k)))
save(cover, OUT / "catalogo" / "capa-cachoeira.jpg", 2400)

# Fotos reais da obra (Frontier 203 + 3 Tonos Cinza Claro, segundo o catálogo)
for i, pg in enumerate([22, 23, 24, 25, 26, 27], start=1):
    save(largest(pg), OUT / "catalogo" / f"obra-{i}.jpg", 2000)
save(largest(38), OUT / "catalogo" / "tecelagem.jpg", 2400)

# Selos (p.37): recortes do vetor em 480 × 480, fundo branco (na página entram com mix-blend-mode: multiply)
SEALS = {
    "iso-9001": (300, 610, 427, 742),
    "iso-14001": (456, 610, 582, 742),
    "garantia-5": (662, 605, 803, 743),
    "performance-10": (830, 605, 971, 743),
    "uso-33": (1015, 622, 1195, 716),
    "etiqueta-inspecao": (1225, 620, 1396, 772),
    "microshield": (580, 855, 723, 999),
    "abnt-ambiental": (752, 832, 878, 970),
    "blife": (905, 875, 1035, 935),
    "fabricado-brasil": (1072, 855, 1206, 948),
}
page = doc[36]
scale, oy = 1687 / 524, 520  # coordenadas medidas numa renderização da página a 1687 px de largura
for name, (x0, y0, x1, y1) in SEALS.items():
    r = fitz.Rect(x0 / scale, (y0 + oy) / scale, x1 / scale, (y1 + oy) / scale)
    s = 640 / max(r.width, r.height)
    pix = page.get_pixmap(clip=r, matrix=fitz.Matrix(s, s), alpha=False)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    side = max(im.size) + 40
    sq = Image.new("RGB", (side, side), "white")
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    dest = OUT / "badges" / f"{name}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    sq.resize((480, 480), Image.LANCZOS).save(dest, optimize=True)
    print(dest.relative_to(ROOT))
