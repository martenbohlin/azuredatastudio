/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';

export class PlanHeader {

	private _graphIndex: number;    // Index of the graph in the view
	private _relativeCost: number;  // Relative cost of the graph to the script
	private _graphIndexAndCostContainer: HTMLElement; //Container that holds the graph index and relative cost


	private _query: string;
	private _queryContainer: HTMLElement; // container that holds query text

	private _recommendations: azdata.QueryPlanRecommendation[];
	private _recommendationsContainer: HTMLElement; // container that holds graph recommendations

	public constructor(
		private _parentContainer: HTMLElement,
		headerData: PlanHeaderData,
		@IInstantiationService public readonly _instantiationService: IInstantiationService) {

		this._graphIndex = headerData.planIndex;
		this._relativeCost = headerData.relativeCost;
		this._query = headerData.query;
		this._recommendations = headerData.recommendations ?? [];

		this._graphIndexAndCostContainer = DOM.$('.index-row');
		this._queryContainer = DOM.$('.query-row');
		this._recommendationsContainer = DOM.$('.recommendations');

		this._parentContainer.appendChild(this._graphIndexAndCostContainer);
		this._parentContainer.appendChild(this._queryContainer);
		this._parentContainer.appendChild(this._recommendationsContainer);

		this.renderGraphIndexAndCost();
		this.renderQueryText();
		this.renderRecommendations();
	}

	public set graphIndex(index: number) {
		this._graphIndex = index;
		this.renderGraphIndexAndCost();
	}
	public set relativeCost(cost: number) {
		this._relativeCost = cost;
		this.renderGraphIndexAndCost();
	}
	public set query(query: string) {
		this._query = query.replace(/(\r\n|\n|\r)/gm, '');
		this.renderQueryText();
	}

	public set recommendations(recommendations: azdata.QueryPlanRecommendation[]) {
		recommendations.forEach(r => {
			r.displayString = r.displayString.replace(/(\r\n|\n|\r)/gm, '');
		});
		this._recommendations = recommendations;
		this.renderRecommendations();
	}

	private renderGraphIndexAndCost() {
		if (this._graphIndex && this._relativeCost) {
			this._graphIndexAndCostContainer.innerText = localize('planHeaderIndexAndCost', "Query {0}: Query cost (relative to the script): {1}%", this._graphIndex, this._relativeCost.toFixed(2));
		}
	}

	private renderQueryText() {
		this._queryContainer.innerText = this._query;
	}

	private renderRecommendations() {
		while (this._recommendationsContainer.firstChild) {
			this._recommendationsContainer.removeChild(this._recommendationsContainer.firstChild);
		}
		this._recommendations.forEach(r => {
			const link = DOM.$('.recommendation-btn');
			link.tabIndex = 0;
			link.ariaLabel = 'button';
			link.innerText = r.displayString;

			//Enabling on click action for recommendations. It will open the recommendation File
			link.onclick = (e) => {
				return this._instantiationService.invokeFunction(openNewQuery, undefined, r.queryWithDescription, RunQueryOnConnectionMode.none);
			};
			//Mapping enter and space key to on click action
			link.onkeydown = (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					// Cancel the default action, if needed
					e.preventDefault();
					link.click();
				}
				return;
			};
			this._recommendationsContainer.appendChild(link);
		});

	}
}

export interface PlanHeaderData {
	planIndex?: number;
	relativeCost?: number;
	query?: string;
	recommendations?: azdata.QueryPlanRecommendation[];
}
