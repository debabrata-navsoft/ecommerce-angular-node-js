import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoaderService } from './core/services/loader.service';
import { Loader } from './shared/components/loader/loader';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Loader],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  loaderService = inject(LoaderService);
}
