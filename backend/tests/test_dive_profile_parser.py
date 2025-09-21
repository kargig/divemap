import pytest
import tempfile
import os
from unittest.mock import patch, mock_open
from xml.etree.ElementTree import Element

from app.services.dive_profile_parser import DiveProfileParser


class TestDiveProfileParser:
    """Test DiveProfileParser functionality."""

    @pytest.fixture
    def parser(self):
        """Create DiveProfileParser instance for testing."""
        return DiveProfileParser()

    @pytest.fixture
    def sample_xml_content(self):
        """Sample XML content for testing."""
        return """<?xml version="1.0" encoding="UTF-8"?>
<dives>
    <dive>
        <diveid>test_dive_123</diveid>
        <number>1</number>
        <date>2024-09-27</date>
        <time>12:11:13</time>
        <duration>82:30</duration>
        <maxdepth>48.7</maxdepth>
        <meandepth>22.068</meandepth>
        <watertemp>24</watertemp>
        <rating>4</rating>
        <visibility>3</visibility>
        <sac>13.147</sac>
        <otu>82</otu>
        <cns>29</cns>
        <tags>Wreck</tags>
        <divesiteid>5520dc00</divesiteid>
        <buddy>Nikos Vardakas</buddy>
        <suit>DrySuit Rofos</suit>
        <cylinder>
            <size>24.0</size>
            <workpressure>232.0</workpressure>
            <description>D12 232 bar</description>
            <o2>22.0</o2>
            <start>210.0</start>
            <end>100.0</end>
            <depth>62.551</depth>
        </cylinder>
        <weightsystem>
            <weight>3.2</weight>
            <description>weight</description>
        </weightsystem>
        <computer>
            <model>Shearwater Perdix AI</model>
            <deviceid>8a66df8d</deviceid>
        </computer>
        <extra_data>
            <Logversion>14(PNF)</Logversion>
            <Serial>206352f8</Serial>
            <FW Version>93</FW Version>
            <Deco model>GF 30/85</Deco model>
            <Battery type>1.5V Lithium</Battery type>
            <Battery at end>1.7 V</Battery at end>
        </extra_data>
        <samples>
            <sample time='0:10 min' depth='2.7 m' temperature='34 C' />
            <sample time='0:20 min' depth='4.0 m' ndl='99:00 min' />
            <sample time='0:30 min' depth='3.8 m' />
            <sample time='0:40 min' depth='4.1 m' />
            <sample time='0:50 min' depth='5.5 m' temperature='33 C' />
            <sample time='1:00 min' depth='4.8 m' />
            <sample time='9:00 min' depth='44.2 m' ndl='0:00 min' cns='3%' />
            <sample time='10:20 min' depth='45.6 m' in_deco='1' stoptime='1:00 min' stopdepth='3.0 m' />
            <sample time='75:10 min' depth='6.8 m' ndl='99:00 min' in_deco='0' stopdepth='0.0 m' />
            <sample time='82:30 min' depth='0.0 m' />
        </samples>
        <events>
            <event time='0:10 min' type='25' flags='1' name='gaschange' cylinder='0' o2='22.0%' />
            <event time='36:00 min' type='25' flags='2' name='gaschange' cylinder='1' o2='49.0%' />
        </events>
    </dive>
</dives>"""

    def test_parse_time_to_minutes_mm_ss_format(self, parser):
        """Test parsing time in MM:SS format."""
        assert parser._parse_time_to_minutes("0:10 min") == 0.16666666666666666
        assert parser._parse_time_to_minutes("1:30 min") == 1.5
        assert parser._parse_time_to_minutes("10:20 min") == 10.333333333333334

    def test_parse_time_to_minutes_hh_mm_ss_format(self, parser):
        """Test parsing time in HH:MM:SS format."""
        assert parser._parse_time_to_minutes("1:00:00 min") == 60.0
        assert parser._parse_time_to_minutes("1:30:00 min") == 90.0
        assert parser._parse_time_to_minutes("2:15:30 min") == 135.5

    def test_parse_time_to_minutes_invalid_format(self, parser):
        """Test parsing time with invalid format."""
        assert parser._parse_time_to_minutes("invalid") == 0.0
        assert parser._parse_time_to_minutes("") == 0.0
        assert parser._parse_time_to_minutes(None) == 0.0

    def test_parse_sample_element_basic(self, parser):
        """Test parsing basic sample element."""
        sample_xml = """<sample time='1:30 min' depth='15.5 m' temperature='25 C' />"""
        sample = Element('sample')
        sample.set('time', '1:30 min')
        sample.set('depth', '15.5 m')
        sample.set('temperature', '25 C')
        
        result = parser._parse_sample_element(sample)
        
        assert result['time'] == '1:30 min'
        assert result['time_minutes'] == 1.5
        assert result['depth'] == 15.5
        assert result['temperature'] == 25

    def test_parse_sample_element_with_ndl(self, parser):
        """Test parsing sample element with NDL."""
        sample = Element('sample')
        sample.set('time', '2:00 min')
        sample.set('depth', '20.0 m')
        sample.set('ndl', '45:00 min')
        
        result = parser._parse_sample_element(sample)
        
        assert result['time'] == '2:00 min'
        assert result['time_minutes'] == 2.0
        assert result['depth'] == 20.0
        assert result['ndl_minutes'] == 45.0

    def test_parse_sample_element_with_cns(self, parser):
        """Test parsing sample element with CNS."""
        sample = Element('sample')
        sample.set('time', '5:00 min')
        sample.set('depth', '30.0 m')
        sample.set('cns', '5%')
        
        result = parser._parse_sample_element(sample)
        
        assert result['time'] == '5:00 min'
        assert result['time_minutes'] == 5.0
        assert result['depth'] == 30.0
        assert result['cns_percent'] == 5

    def test_parse_sample_element_with_decompression(self, parser):
        """Test parsing sample element with decompression status."""
        sample = Element('sample')
        sample.set('time', '10:20 min')
        sample.set('depth', '45.6 m')
        sample.set('in_deco', '1')
        sample.set('stoptime', '1:00 min')
        sample.set('stopdepth', '3.0 m')
        
        result = parser._parse_sample_element(sample)
        
        assert result['time'] == '10:20 min'
        assert result['time_minutes'] == 10.333333333333334
        assert result['depth'] == 45.6
        assert result['in_deco'] == True
        assert result['stoptime_minutes'] == 1.0
        assert result['stopdepth'] == 3.0

    def test_parse_sample_element_with_decompression_off(self, parser):
        """Test parsing sample element with decompression off."""
        sample = Element('sample')
        sample.set('time', '75:10 min')
        sample.set('depth', '6.8 m')
        sample.set('ndl', '99:00 min')
        sample.set('in_deco', '0')
        sample.set('stopdepth', '0.0 m')
        
        result = parser._parse_sample_element(sample)
        
        assert result['time'] == '75:10 min'
        assert result['time_minutes'] == 75.16666666666667
        assert result['depth'] == 6.8
        assert result['ndl_minutes'] == 99.0
        assert result['in_deco'] == False
        assert result['stopdepth'] == 0.0

    def test_parse_event_element_gas_change(self, parser):
        """Test parsing gas change event element."""
        event = Element('event')
        event.set('time', '36:00 min')
        event.set('type', '25')
        event.set('flags', '2')
        event.set('name', 'gaschange')
        event.set('cylinder', '1')
        event.set('o2', '49.0%')
        
        result = parser._parse_event_element(event)
        
        assert result['time'] == '36:00 min'
        assert result['time_minutes'] == 36.0
        assert result['type'] == '25'
        assert result['flags'] == '2'
        assert result['name'] == 'gaschange'
        assert result['cylinder'] == '1'
        assert result['o2'] == '49.0%'

    def test_parse_dive_element_basic(self, parser):
        """Test parsing basic dive element."""
        dive_xml = """<dive>
            <diveid>test_dive_123</diveid>
            <number>1</number>
            <date>2024-09-27</date>
            <time>12:11:13</time>
            <duration>82:30</duration>
            <maxdepth>48.7</maxdepth>
            <meandepth>22.068</meandepth>
            <watertemp>24</watertemp>
            <rating>4</rating>
            <visibility>3</visibility>
            <sac>13.147</sac>
            <otu>82</otu>
            <cns>29</cns>
            <tags>Wreck</tags>
            <divesiteid>5520dc00</divesiteid>
            <buddy>Nikos Vardakas</buddy>
            <suit>DrySuit Rofos</suit>
        </dive>"""
        
        dive = Element('dive')
        dive.set('diveid', 'test_dive_123')
        dive.text = None
        
        # Add child elements
        for tag, value in [
            ('number', '1'), ('date', '2024-09-27'), ('time', '12:11:13'),
            ('duration', '82:30'), ('maxdepth', '48.7'), ('meandepth', '22.068'),
            ('watertemp', '24'), ('rating', '4'), ('visibility', '3'),
            ('sac', '13.147'), ('otu', '82'), ('cns', '29'),
            ('tags', 'Wreck'), ('divesiteid', '5520dc00'),
            ('buddy', 'Nikos Vardakas'), ('suit', 'DrySuit Rofos')
        ]:
            child = Element(tag)
            child.text = value
            dive.append(child)
        
        result = parser._parse_dive_element(dive)
        
        assert result['dive_number'] == '1'
        assert result['date'] == '2024-09-27'
        assert result['time'] == '12:11:13'
        assert result['duration'] == '82:30 min'
        assert result['max_depth'] == 48.7
        assert result['mean_depth'] == 22.068
        assert result['water_temperature'] == 24
        assert result['rating'] == '4'
        assert result['visibility'] == '3'
        assert result['sac'] == '13.147 l/min'
        assert result['otu'] == '82'
        assert result['cns'] == '29%'
        assert result['tags'] == 'Wreck'
        assert result['divesiteid'] == '5520dc00'
        assert result['buddy'] == 'Nikos Vardakas'
        assert result['suit'] == 'DrySuit Rofos'

    def test_parse_dive_element_with_cylinder(self, parser):
        """Test parsing dive element with cylinder information."""
        dive = Element('dive')
        dive.set('diveid', 'test_dive_123')
        
        cylinder = Element('cylinder')
        cylinder.set('size', '24.0')
        cylinder.set('workpressure', '232.0')
        cylinder.set('description', 'D12 232 bar')
        cylinder.set('o2', '22.0')
        cylinder.set('start', '210.0')
        cylinder.set('end', '100.0')
        cylinder.set('depth', '62.551')
        dive.append(cylinder)
        
        result = parser._parse_dive_element(dive)
        
        assert 'cylinder' in result
        assert result['cylinder']['size'] == '24.0 l'
        assert result['cylinder']['workpressure'] == '232.0 bar'
        assert result['cylinder']['description'] == 'D12 232 bar'
        assert result['cylinder']['o2'] == '22.0%'
        assert result['cylinder']['start'] == '210.0 bar'
        assert result['cylinder']['end'] == '100.0 bar'
        assert result['cylinder']['depth'] == '62.551 m'

    def test_parse_dive_element_with_weightsystem(self, parser):
        """Test parsing dive element with weightsystem information."""
        dive = Element('dive')
        dive.set('diveid', 'test_dive_123')
        
        weightsystem = Element('weightsystem')
        weightsystem.set('weight', '3.2')
        weightsystem.set('description', 'weight')
        dive.append(weightsystem)
        
        result = parser._parse_dive_element(dive)
        
        assert 'weightsystem' in result
        assert result['weightsystem']['weight'] == '3.2 kg'
        assert result['weightsystem']['description'] == 'weight'

    def test_parse_dive_element_with_computer(self, parser):
        """Test parsing dive element with computer information."""
        dive = Element('dive')
        dive.set('diveid', 'test_dive_123')
        
        computer = Element('computer')
        computer.set('model', 'Shearwater Perdix AI')
        computer.set('deviceid', '8a66df8d')
        dive.append(computer)
        
        result = parser._parse_dive_element(dive)
        
        assert 'model' in result
        assert result['model'] == 'Shearwater Perdix AI'
        assert 'deviceid' in result
        assert result['deviceid'] == '8a66df8d'

    def test_parse_dive_element_with_extra_data(self, parser):
        """Test parsing dive element with extra data."""
        dive = Element('dive')
        dive.set('diveid', 'test_dive_123')
        
        extra_data = Element('extra_data')
        extra_data.set('Logversion', '14(PNF)')
        extra_data.set('Serial', '206352f8')
        extra_data.set('FW Version', '93')
        extra_data.set('Deco model', 'GF 30/85')
        extra_data.set('Battery type', '1.5V Lithium')
        extra_data.set('Battery at end', '1.7 V')
        dive.append(extra_data)
        
        result = parser._parse_dive_element(dive)
        
        assert 'extra_data' in result
        assert result['extra_data']['Logversion'] == '14(PNF)'
        assert result['extra_data']['Serial'] == '206352f8'
        assert result['extra_data']['FW Version'] == '93'
        assert result['extra_data']['Deco model'] == 'GF 30/85'
        assert result['extra_data']['Battery type'] == '1.5V Lithium'
        assert result['extra_data']['Battery at end'] == '1.7 V'

    def test_parse_xml_file_success(self, parser, sample_xml_content):
        """Test successful XML file parsing."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as temp_file:
            temp_file.write(sample_xml_content)
            temp_file.flush()
            
            try:
                result = parser.parse_xml_file(temp_file.name)
                
                assert result is not None
                assert 'dive_number' in result
                assert 'samples' in result
                assert 'events' in result
                assert len(result['samples']) == 10
                assert len(result['events']) == 2
                
                # Check sample data
                first_sample = result['samples'][0]
                assert first_sample['time'] == '0:10 min'
                assert first_sample['depth'] == 2.7
                assert first_sample['temperature'] == 34
                
                # Check decompression sample
                deco_sample = result['samples'][7]  # 10:20 min sample
                assert deco_sample['in_deco'] == True
                assert deco_sample['stoptime_minutes'] == 1.0
                assert deco_sample['stopdepth'] == 3.0
                
                # Check decompression off sample
                no_deco_sample = result['samples'][8]  # 75:10 min sample
                assert no_deco_sample['in_deco'] == False
                assert no_deco_sample['ndl_minutes'] == 99.0
                
                # Check calculated values
                assert result['calculated_max_depth'] == 48.7
                assert result['calculated_avg_depth'] > 0
                assert result['calculated_duration_minutes'] > 0
                
            finally:
                os.unlink(temp_file.name)

    def test_parse_xml_file_not_found(self, parser):
        """Test XML file parsing when file doesn't exist."""
        result = parser.parse_xml_file('/nonexistent/file.xml')
        assert result is None

    def test_parse_xml_file_invalid_xml(self, parser):
        """Test XML file parsing with invalid XML."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as temp_file:
            temp_file.write('invalid xml content')
            temp_file.flush()
            
            try:
                result = parser.parse_xml_file(temp_file.name)
                assert result is None
            finally:
                os.unlink(temp_file.name)

    def test_parse_xml_file_empty_dives(self, parser):
        """Test XML file parsing with empty dives."""
        empty_xml = """<?xml version="1.0" encoding="UTF-8"?>
<dives>
</dives>"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as temp_file:
            temp_file.write(empty_xml)
            temp_file.flush()
            
            try:
                result = parser.parse_xml_file(temp_file.name)
                assert result is None
            finally:
                os.unlink(temp_file.name)

    def test_calculate_dive_statistics(self, parser):
        """Test dive statistics calculation."""
        samples = [
            {'time_minutes': 0, 'depth': 0, 'temperature': 20},
            {'time_minutes': 1, 'depth': 10, 'temperature': 19},
            {'time_minutes': 2, 'depth': 20, 'temperature': 18},
            {'time_minutes': 3, 'depth': 15, 'temperature': 17},
            {'time_minutes': 4, 'depth': 5, 'temperature': 16},
            {'time_minutes': 5, 'depth': 0, 'temperature': 15}
        ]
        
        result = parser._calculate_dive_statistics(samples)
        
        assert result['calculated_max_depth'] == 20
        assert result['calculated_avg_depth'] == 8.333333333333334
        assert result['calculated_duration_minutes'] == 5
        assert result['temperature_range']['min'] == 15
        assert result['temperature_range']['max'] == 20

    def test_calculate_dive_statistics_empty_samples(self, parser):
        """Test dive statistics calculation with empty samples."""
        result = parser._calculate_dive_statistics([])
        
        assert result['calculated_max_depth'] == 0
        assert result['calculated_avg_depth'] == 0
        assert result['calculated_duration_minutes'] == 0
        assert result['temperature_range']['min'] == 0
        assert result['temperature_range']['max'] == 0

    def test_calculate_dive_statistics_no_temperature(self, parser):
        """Test dive statistics calculation with no temperature data."""
        samples = [
            {'time_minutes': 0, 'depth': 0},
            {'time_minutes': 1, 'depth': 10},
            {'time_minutes': 2, 'depth': 20}
        ]
        
        result = parser._calculate_dive_statistics(samples)
        
        assert result['calculated_max_depth'] == 20
        assert result['calculated_avg_depth'] == 10
        assert result['calculated_duration_minutes'] == 2
        assert result['temperature_range']['min'] == 0
        assert result['temperature_range']['max'] == 0
