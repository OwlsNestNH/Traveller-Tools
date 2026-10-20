# Campaign territory

On the main map, choose **Campaign territory**. Click a hex to claim or unclaim it for Drinax. Clicks only change the preview. **Undo edit** reverses preview edits; **Save territory** commits them. Cancel, Close and Escape discard unsaved changes. Reloading also discards the preview and keeps the last saved territory.

There is no automatic fill, bridge or inferred claim. Adjacent selected hexes share a border; holes and separated claims stay exactly as selected. Empty or unloaded hexes may be claimed manually. Use the arrows or the collapsed world finder to move the editing view.

**Start with Drinax + Asim** explicitly adds those two public worlds to the preview, including their campaign allegiance. It is never applied automatically. The separate world-allegiance section changes the campaign label independently of territorial claims. Published Traveller Map allegiance remains unchanged. Violet fill and lavender outlines identify the campaign layer. The main map's political overlay toggle controls its visibility; planned route lines remain visible.

Saved claims are included in campaign JSON backups and validated on import. The ordinary campaign Undo can reverse a saved territory change. Save failures before writing retain the draft for retry; uncertain or completed-write failures require reload instead of a duplicate Save.

New player links carry a frozen, public copy of exact claims and allegiance assignments. Both maps use the same border geometry. The player viewer reads no campaign storage and cannot edit claims. Old links remain valid and have no campaign territory. The nearby player map still uses live Traveller Map reference data; failed reference loading does not change the frozen snapshot.

Limits: one campaign faction (Drinax), 512 claimed hexes, 128 world-allegiance assignments, integer coordinates from -32767 to 32767. Sharing retains the existing 8,192-character total URL limit and rejects oversized links without dropping claims. Codec 8 / snapshot model 7 add territory; older viewers need the updated application to read new links.

Measured with the synthetic player fixture and two separate world-allegiance assignments:

| Manual hexes | Added characters | Full deployed URL characters |
| --- | ---: | ---: |
| None | 0 | 489 |
| 2 | 18 | 507 |
| 10 | 50 | 539 |
| 30 | 130 | 619 |

Coordinate magnitude and other snapshot content affect total size. No polygons, private notes, credentials or referee-only fields are serialized.
