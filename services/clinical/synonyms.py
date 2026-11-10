"""International pharmacopoeia and commercial brand synonym bridge."""

from __future__ import annotations
from typing import Dict, Optional


class SynonymBridge:
    """Translates international drug nomenclature (BAN/IP/EP) and commercial brands to canonical USAN/RxNorm names."""

    _SYNONYMS: Dict[str, str] = {
        # Essential international salt synonyms
        "paracetamol": "acetaminophen",
        "pcm": "acetaminophen",
        "salbutamol": "albuterol",
        "frusemide": "furosemide",
        "amoxycillin": "amoxicillin",
        "lignocaine": "lidocaine",
        "thyroxine": "levothyroxine",
        "co-amoxiclav": "amoxicillin",
        "chlorpheniramine": "chlorpheniramine maleate",
        "rifampicin": "rifampin",
        # Top high-frequency Indian & international brand trade names
        "dolo": "acetaminophen",
        "crocin": "acetaminophen",
        "calpol": "acetaminophen",
        "panadol": "acetaminophen",
        "asthalin": "albuterol",
        "ventolin": "albuterol",
        "lasix": "furosemide",
        "amoxil": "amoxicillin",
        "mox": "amoxicillin",
        "novamox": "amoxicillin",
        "augmentin": "amoxicillin / clavulanate",
        "clavam": "amoxicillin / clavulanate",
        "moxikind": "amoxicillin",
        "moxikind-cv": "amoxicillin / clavulanate",
        "pan": "pantoprazole",
        "pan 40": "pantoprazole",
        "pantocid": "pantoprazole",
        "pantodac": "pantoprazole",
        "pantop": "pantoprazole",
        "omez": "omeprazole",
        "omee": "omeprazole",
        "glycomet": "metformin",
        "cetapin": "metformin",
        "glucophage": "metformin",
        "telma": "telmisartan",
        "telmikind": "telmisartan",
        "telpres": "telmisartan",
        "amlong": "amlodipine",
        "norvasc": "amlodipine",
        "atorva": "atorvastatin",
        "lipitor": "atorvastatin",
        "storvas": "atorvastatin",
        "rosuvas": "rosuvastatin",
        "rozavel": "rosuvastatin",
        "cetzine": "cetirizine",
        "alerid": "cetirizine",
        "zyrtec": "cetirizine",
        "ecosprin": "aspirin",
        "disprin": "aspirin",
        "combiflam": "ibuprofen",
        "brufen": "ibuprofen",
        "voveran": "diclofenac",
        "ciplox": "ciprofloxacin",
        "cifran": "ciprofloxacin",
        "rantac": "ranitidine",
        "zinetac": "ranitidine",
        "allegra": "fexofenadine",
        "montair": "montelukast",
        "montair-lc": "montelukast / levocetirizine",
        "montek-lc": "montelukast / levocetirizine",
        "stonclos": "montelukast / levocetirizine",
        "azithral": "azithromycin",
        "azee": "azithromycin",
        "zithromax": "azithromycin",
        "shelcal": "calcium carbonate",
        "janumet": "sitagliptin / metformin",
        # Respiratory & Chest Specialty
        "doxolin": "doxofylline",
        "doxoril": "doxofylline",
        "doxiflo": "doxofylline",
        "buditone": "budesonide",
        "buditone n": "budesonide",
        "budecort": "budesonide",
        "budetrol": "budesonide",
        "foracort": "budesonide",
        "indoclo": "indomethacin",
        "indocap": "indomethacin",
        "indocid": "indomethacin",
        "radyle": "rabeprazole / domperidone",
        "radyle d": "rabeprazole / domperidone",
        "cap radyle d": "rabeprazole / domperidone",
        "razo": "rabeprazole",
        "razo-d": "rabeprazole / domperidone",
        "razo d": "rabeprazole / domperidone",
        "rablet": "rabeprazole",
        "rablet-d": "rabeprazole / domperidone",
        "rablet d": "rabeprazole / domperidone",
        "rabicip": "rabeprazole",
        "rabicip-d": "rabeprazole / domperidone",
        "cyra": "rabeprazole",
        "happi": "rabeprazole",
        "montek": "montelukast",
        "montas": "montelukast",
        "telekast": "montelukast",
        "zerodol": "aceclofenac",
        "hifenac": "aceclofenac",
        "pulmoclear": "acebrophylline",
        "polluton": "acebrophylline",
        "macphylline": "acebrophylline",
        "deriphyllin": "theophylline",
        "levolin": "levalbuterol",
        "duolin": "ipratropium",
    }

    @classmethod
    def resolve_synonym(cls, name: str) -> Optional[str]:
        """Return the canonical generic equivalent if present in the synonym bridge."""
        if not name:
            return None
        cleaned = name.strip().lower()
        return cls._SYNONYMS.get(cleaned)

    @classmethod
    def contains(cls, name: str) -> bool:
        """Check whether a given name is indexed in the synonym dictionary."""
        return name.strip().lower() in cls._SYNONYMS

