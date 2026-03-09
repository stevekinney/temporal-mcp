import { describe, expect, mock, test } from 'bun:test';
import { RootsDiscovery } from '../../src/roots/discovery.ts';
import type { Root } from '../../src/roots/discovery.ts';

describe('RootsDiscovery', () => {
	test('getRoots() returns empty array initially', () => {
		const discovery = new RootsDiscovery();
		expect(discovery.getRoots()).toEqual([]);
	});

	test('handleRootsChanged() updates roots', () => {
		const discovery = new RootsDiscovery();
		const newRoots: Root[] = [
			{ uri: 'file:///project/a', name: 'Project A' },
			{ uri: 'file:///project/b', name: 'Project B' },
		];

		discovery.handleRootsChanged(newRoots);
		expect(discovery.getRoots()).toEqual(newRoots);
	});

	test('handleRootsChanged() notifies listeners', () => {
		const discovery = new RootsDiscovery();
		const listener = mock(() => {});
		discovery.onRootsChanged(listener);

		const newRoots: Root[] = [
			{ uri: 'file:///project/c', name: 'Project C' },
		];

		discovery.handleRootsChanged(newRoots);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(newRoots);
	});

	test('onRootsChanged() registers a callback that receives updates', () => {
		const discovery = new RootsDiscovery();
		const receivedRoots: Root[][] = [];

		discovery.onRootsChanged((roots) => {
			receivedRoots.push([...roots]);
		});

		discovery.handleRootsChanged([{ uri: 'file:///a' }]);
		discovery.handleRootsChanged([
			{ uri: 'file:///a' },
			{ uri: 'file:///b' },
		]);

		expect(receivedRoots).toHaveLength(2);
		expect(receivedRoots[0]).toHaveLength(1);
		expect(receivedRoots[1]).toHaveLength(2);
	});

	test('multiple listeners are all notified', () => {
		const discovery = new RootsDiscovery();
		const listener1 = mock(() => {});
		const listener2 = mock(() => {});

		discovery.onRootsChanged(listener1);
		discovery.onRootsChanged(listener2);

		discovery.handleRootsChanged([{ uri: 'file:///x' }]);

		expect(listener1).toHaveBeenCalledTimes(1);
		expect(listener2).toHaveBeenCalledTimes(1);
	});
});
