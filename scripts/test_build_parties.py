import unittest
from build_parties_csv import consolidate, slugify

class TestConsolidate(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify('Agrawal family'), 'agrawal-family')
        self.assertEqual(slugify('Shankar Rao & Padma Grandhi'), 'shankar-rao-padma-grandhi')

    def test_consolidate_filters_and_dedupes(self):
        # rows are dicts: {'name':..., 'count':...} already extracted per sheet
        rows = [
            {'name': 'Agrawal family', 'count': 4},
            {'name': 'Total Guest Count', 'count': 107},   # junk/total -> dropped by caller filter, but ensure name-based skip works
            {'name': '', 'count': 2},                       # blank -> dropped
            {'name': 'Nana/Nani', 'count': 0},              # zero -> dropped
            {'name': 'Khandavalli family', 'count': 4},
            {'name': 'Khandavalli family', 'count': 5},      # dup -> keep max (5)
        ]
        out = consolidate(rows, drop_names={'total guest count'})
        names = {r['name']: r['count'] for r in out}
        self.assertEqual(names, {'Agrawal family': 4, 'Khandavalli family': 5})
        # IDs are unique and slugified
        ids = [r['id'] for r in out]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn('agrawal-family', ids)

if __name__ == '__main__':
    unittest.main()
